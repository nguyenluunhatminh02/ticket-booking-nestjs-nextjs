import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ResaleStatus, TicketStatus } from '../entities/enums';
import { ResaleListingDto } from '../dto';
import { ResaleListingResponseDto } from '../dto/response/resale-listing-response.dto';
import { TicketService } from './ticket.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ResaleService {
  constructor(
    private prisma: PrismaService,
    private ticketService: TicketService,
  ) {}

  async listForResale(dto: ResaleListingDto, user: any): Promise<ResaleListingResponseDto> {
    const ticket = await this.ticketService.getTicketEntityById(dto.ticketId);
    if (ticket.userId !== user.id) throw new BadRequestException('Not the ticket owner');
    if (ticket.status !== TicketStatus.VALID) {
      throw new BadRequestException('Only VALID tickets can be listed for resale');
    }

    // Anti-scalping: max 150% of original price
    const maxPrice = Number(ticket.price) * 1.5;
    if (dto.askingPrice > maxPrice) {
      throw new BadRequestException(
        `Asking price cannot exceed ${maxPrice} (150% of original)`,
      );
    }

    const platformFeePercent = 5;
    const platformFeeAmount = (dto.askingPrice * platformFeePercent) / 100;
    const sellerPayout = dto.askingPrice - platformFeeAmount;

    const saved = await this.prisma.resaleListing.create({
      data: {
        ticketId: dto.ticketId,
        eventId: ticket.eventId,
        sellerId: user.id,
        askingPrice: dto.askingPrice,
        originalPrice: Number(ticket.price),
        currency: ticket.currency || 'USD',
        platformFeePercent,
        platformFeeAmount,
        sellerPayout,
        status: ResaleStatus.LISTED,
      },
    });
    return this.toResponse(saved, ticket);
  }

  async lockForPurchase(listingId: string, buyer: any): Promise<ResaleListingResponseDto> {
    return this.prisma.$transaction(
      async (tx) => {
        // Pessimistic lock via raw query
        const [listing] = await tx.$queryRaw<any[]>`
          SELECT * FROM resale_listings WHERE id = ${listingId}::uuid FOR UPDATE
        `;
        if (!listing) throw new NotFoundException('Listing not found');

        if (listing.seller_id === buyer.id) {
          throw new BadRequestException('Cannot buy your own listing');
        }

        // Release expired lock atomically
        if (
          listing.status === ResaleStatus.LOCKED &&
          listing.lock_expires_at &&
          new Date(listing.lock_expires_at) < new Date()
        ) {
          listing.status = ResaleStatus.LISTED;
        }

        if (listing.status !== ResaleStatus.LISTED) {
          throw new ConflictException('Listing is not available');
        }

        const updated = await tx.resaleListing.update({
          where: { id: listingId },
          data: {
            status: ResaleStatus.LOCKED,
            buyerId: buyer.id,
            lockExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
          include: {
            originalTicket: {
              include: { event: { include: { venue: true } } },
            },
          },
        });
        return this.toResponse(updated, updated.originalTicket);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async completePurchase(listingId: string, buyer: any): Promise<ResaleListingResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const [listing] = await tx.$queryRaw<any[]>`
        SELECT * FROM resale_listings WHERE id = ${listingId}::uuid FOR UPDATE
      `;
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.status !== ResaleStatus.LOCKED) {
        throw new BadRequestException('Listing is not locked');
      }
      if (listing.buyer_id !== buyer.id) {
        throw new BadRequestException('Not the buyer for this listing');
      }
      if (listing.lock_expires_at && new Date(listing.lock_expires_at) < new Date()) {
        throw new ConflictException('Purchase lock has expired');
      }

      const oldTicket = await tx.ticket.findUnique({
        where: { id: listing.ticket_id },
        include: { event: { include: { venue: true } }, tier: true },
      });
      if (!oldTicket || oldTicket.status !== TicketStatus.VALID) {
        throw new ConflictException('Original ticket is no longer valid');
      }

      await tx.ticket.update({
        where: { id: oldTicket.id },
        data: { status: TicketStatus.CANCELLED, cancelledAt: new Date() },
      });

      const newTicketCode = 'TKT-' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      const savedTicket = await tx.ticket.create({
        data: {
          ticketCode: newTicketCode,
          reservationId: oldTicket.reservationId,
          userId: buyer.id,
          eventId: oldTicket.eventId,
          tierId: oldTicket.tierId,
          seatId: oldTicket.seatId,
          qrCodeData: JSON.stringify({ ticketCode: newTicketCode, eventId: oldTicket.eventId }),
          status: TicketStatus.VALID,
          tierName: oldTicket.tierName,
          seatLabel: oldTicket.seatLabel,
          price: Number(listing.asking_price),
          currency: listing.currency,
        },
      });

      const saved = await tx.resaleListing.update({
        where: { id: listingId },
        data: {
          status: ResaleStatus.SOLD,
          soldAt: new Date(),
          newTicketId: savedTicket.id,
        },
      });

      const resp = this.toResponse(saved, oldTicket);
      resp.newTicketCode = newTicketCode;
      return resp;
    }, { isolationLevel: 'Serializable' });
  }

  async cancelListing(listingId: string, user: any): Promise<ResaleListingResponseDto> {
    const listing = await this.prisma.resaleListing.findUnique({
      where: { id: listingId },
      include: {
        originalTicket: {
          include: { event: { include: { venue: true } } },
        },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== user.id) throw new BadRequestException('Not the seller');
    if (listing.status !== ResaleStatus.LISTED && listing.status !== ResaleStatus.LOCKED) {
      throw new BadRequestException('Cannot cancel listing');
    }

    const saved = await this.prisma.resaleListing.update({
      where: { id: listingId },
      data: { status: ResaleStatus.CANCELLED, cancelledAt: new Date() },
    });
    return this.toResponse(saved, listing.originalTicket);
  }

  async getMarketplaceByEvent(
    eventId: string,
    page = 0,
    size = 20,
  ): Promise<{ content: ResaleListingResponseDto[]; totalElements: number; totalPages: number }> {
    const where = { eventId, status: ResaleStatus.LISTED };
    const include = {
      originalTicket: { include: { event: { include: { venue: true } } } },
      seller: true,
    };
    const [listings, total] = await Promise.all([
      this.prisma.resaleListing.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.resaleListing.count({ where }),
    ]);
    return {
      content: listings.map((l: any) => this.toResponse(l, l.originalTicket)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getAllMarketplace(
    page = 0,
    size = 20,
  ): Promise<{ content: ResaleListingResponseDto[]; totalElements: number; totalPages: number }> {
    const where = { status: ResaleStatus.LISTED };
    const include = {
      originalTicket: { include: { event: { include: { venue: true } } } },
      seller: true,
    };
    const [listings, total] = await Promise.all([
      this.prisma.resaleListing.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.resaleListing.count({ where }),
    ]);
    return {
      content: listings.map((l: any) => this.toResponse(l, l.originalTicket)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getMyListings(
    userId: string,
    page = 0,
    size = 20,
  ): Promise<{ content: ResaleListingResponseDto[]; totalElements: number; totalPages: number }> {
    const where = { sellerId: userId };
    const include = {
      originalTicket: { include: { event: { include: { venue: true } } } },
    };
    const [listings, total] = await Promise.all([
      this.prisma.resaleListing.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.resaleListing.count({ where }),
    ]);
    return {
      content: listings.map((l: any) => this.toResponse(l, l.originalTicket)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getListingDetails(listingId: string): Promise<ResaleListingResponseDto> {
    const listing = await this.prisma.resaleListing.findUnique({
      where: { id: listingId },
      include: {
        originalTicket: { include: { event: { include: { venue: true } } } },
        seller: true,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.toResponse(listing, listing.originalTicket);
  }

  private toResponse(l: any, ticket?: any): ResaleListingResponseDto {
    return {
      id: l.id,
      eventId: l.eventId,
      eventName: ticket?.event?.name ?? null,
      eventCoverImageUrl: ticket?.event?.coverImageUrl ?? null,
      eventDate: ticket?.event?.eventDate ?? null,
      venueName: ticket?.event?.venue?.name ?? null,
      tierName: ticket?.tierName ?? null,
      seatLabel: ticket?.seatLabel ?? null,
      askingPrice: Number(l.askingPrice),
      originalPrice: Number(l.originalPrice),
      currency: l.currency,
      platformFeePercent: Number(l.platformFeePercent),
      platformFeeAmount: Number(l.platformFeeAmount),
      sellerPayout: Number(l.sellerPayout),
      sellerId: l.sellerId,
      sellerName: l.seller
        ? `${l.seller.firstName || ''} ${l.seller.lastName || ''}`.trim()
        : null,
      buyerId: l.buyerId,
      status: l.status,
      lockExpiresAt: l.lockExpiresAt,
      soldAt: l.soldAt,
      createdAt: l.createdAt,
      newTicketCode: null,
    };
  }
}
