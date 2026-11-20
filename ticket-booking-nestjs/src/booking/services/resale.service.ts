import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import {
  ResaleStatus,
  TicketStatus,
  PaymentStatus,
  PaymentProvider,
} from '../entities/enums';
import { ResaleListingDto } from '../dto';
import { ResaleListingResponseDto } from '../dto/response/resale-listing-response.dto';
import { PaymentResponseDto } from '../dto/response/payment-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResaleService {
  private readonly logger = new Logger(ResaleService.name);
  private stripeClient: any;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && !stripeKey.startsWith('your-')) {
      try {
        const Stripe = require('stripe');
        this.stripeClient = new Stripe(stripeKey);
      } catch {
        this.stripeClient = null;
      }
    }
  }

  async createListing(dto: ResaleListingDto, user: any): Promise<ResaleListingResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: {
        event: { include: { venue: true } },
        tier: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== user.id) {
      throw new BadRequestException('Not authorized to resell this ticket');
    }
    if (ticket.status !== TicketStatus.VALID) {
      throw new BadRequestException('Ticket is not valid for resale');
    }

    // Check if ticket already has an active listing
    const existing = await this.prisma.resaleListing.findFirst({
      where: {
        ticketId: dto.ticketId,
        status: { in: [ResaleStatus.LISTED, ResaleStatus.LOCKED] },
      },
    });
    if (existing) {
      throw new ConflictException('Ticket already has an active resale listing');
    }

    // Enforce anti-scalping: asking price cannot exceed original price * maxMarkup
    const maxMarkup = 1.5; // 50% markup cap
    const maxPrice = Number(ticket.price) * maxMarkup;
    if (dto.askingPrice > maxPrice) {
      throw new BadRequestException(
        `Asking price cannot exceed ${maxMarkup * 100}% of original price (${maxPrice})`,
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

  async getMarketplace(eventId?: string): Promise<ResaleListingResponseDto[]> {
    const where: any = { status: ResaleStatus.LISTED };
    if (eventId) {
      where.originalTicket = { eventId };
    }

    const listings = await this.prisma.resaleListing.findMany({
      where,
      include: {
        originalTicket: {
          include: { event: { include: { venue: true } }, tier: true },
        },
        seller: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return listings.map((l) => this.toResponse(l, l.originalTicket));
  }

  async lockListing(listingId: string, buyer: any): Promise<ResaleListingResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const [listing] = await tx.$queryRaw<any[]>`
        SELECT * FROM resale_listings WHERE id = ${listingId}::uuid FOR UPDATE
      `;
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.status !== ResaleStatus.LISTED) {
        throw new BadRequestException('Listing is not available');
      }
      if (listing.seller_id === buyer.id) {
        throw new BadRequestException('Cannot purchase your own listing');
      }

      const lockExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const saved = await tx.resaleListing.update({
        where: { id: listingId },
        data: {
          status: ResaleStatus.LOCKED,
          buyerId: buyer.id,
          lockExpiresAt: lockExpiry,
        },
      });

      const ticket = await tx.ticket.findUnique({
        where: { id: listing.ticket_id },
        include: { event: { include: { venue: true } }, tier: true },
      });
      return this.toResponse(saved, ticket);
    }, { isolationLevel: 'Serializable' });
  }

  async initiateResalePayment(listingId: string, buyer: any, provider: PaymentProvider): Promise<PaymentResponseDto> {
    const listing = await this.prisma.resaleListing.findUnique({
      where: { id: listingId },
      include: { originalTicket: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== ResaleStatus.LOCKED) {
      throw new BadRequestException('Listing must be locked before payment');
    }
    if (listing.buyerId !== buyer.id) {
      throw new BadRequestException('Not the buyer for this listing');
    }
    if (listing.lockExpiresAt && new Date(listing.lockExpiresAt) < new Date()) {
      throw new ConflictException('Purchase lock has expired');
    }

    const amount = Number(listing.askingPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }

    if (provider !== PaymentProvider.STRIPE) {
      throw new BadRequestException('Only Stripe is supported for resale payments');
    }
    if (!this.stripeClient) {
      throw new BadRequestException('Stripe is not configured');
    }

    let paymentIntent: any;
    try {
      paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: (listing.currency || 'USD').toLowerCase(),
        metadata: { resaleListingId: listingId, buyerId: buyer.id, type: 'resale' },
        automatic_payment_methods: { enabled: true },
      });
    } catch (err: any) {
      throw new BadRequestException(`Stripe error: ${err.message}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark any existing pending payments as failed
      await tx.payment.updateMany({
        where: { resaleListingId: listingId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: 'Replaced by new payment' },
      });

      const saved = await tx.payment.create({
        data: {
          resaleListingId: listingId,
          userId: buyer.id,
          amount,
          currency: listing.currency || 'USD',
          provider,
          status: PaymentStatus.PENDING,
          providerPaymentId: paymentIntent.id,
          providerClientSecret: paymentIntent.client_secret,
        },
      });
      return this.toPaymentResponse(saved);
    }, { isolationLevel: 'Serializable' });
  }

  async confirmResalePayment(paymentIntentId: string, listingId: string, buyerId: string): Promise<ResaleListingResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { resaleListingId: listingId, providerPaymentId: paymentIntentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== buyerId) throw new BadRequestException('Not authorized');

    if (payment.status === PaymentStatus.COMPLETED) {
      // Idempotent: already completed, return listing state
      const listing = await this.prisma.resaleListing.findUnique({
        where: { id: listingId },
        include: { originalTicket: { include: { event: { include: { venue: true } }, tier: true } } },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      return this.toResponse(listing, listing.originalTicket);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment cannot be confirmed in current state');
    }
    if (!this.stripeClient) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Verify with Stripe
    let intent: any;
    try {
      intent = await this.stripeClient.paymentIntents.retrieve(paymentIntentId);
    } catch {
      throw new BadRequestException('Unable to verify payment with Stripe');
    }
    if (intent.status !== 'succeeded') {
      throw new BadRequestException('Payment has not succeeded');
    }
    const expectedAmount = Math.round(Number(payment.amount) * 100);
    if (
      intent.amount_received !== expectedAmount ||
      intent.currency !== (payment.currency || 'USD').toLowerCase()
    ) {
      throw new BadRequestException('Payment amount mismatch');
    }
    if (intent.metadata?.resaleListingId && intent.metadata.resaleListingId !== listingId) {
      throw new BadRequestException('Payment does not belong to this listing');
    }

    // Transfer ticket
    return this.prisma.$transaction(async (tx) => {
      const [lockedPayment] = await tx.$queryRaw<any[]>`
        SELECT * FROM payments WHERE id = ${payment.id}::uuid AND status = 'PENDING' FOR UPDATE
      `;
      if (!lockedPayment) {
        const current = await tx.payment.findUnique({ where: { id: payment.id } });
        if (current?.status === PaymentStatus.COMPLETED) {
          const listing = await tx.resaleListing.findUnique({
            where: { id: listingId },
            include: { originalTicket: { include: { event: { include: { venue: true } }, tier: true } } },
          });
          if (!listing) throw new NotFoundException('Listing not found');
          return this.toResponse(listing, listing.originalTicket);
        }
        throw new ConflictException('Payment state changed');
      }

      // Mark payment completed
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, completedAt: new Date() },
      });

      // Lock listing and verify state
      const [listing] = await tx.$queryRaw<any[]>`
        SELECT * FROM resale_listings WHERE id = ${listingId}::uuid FOR UPDATE
      `;
      if (!listing) throw new NotFoundException('Listing not found');
      if (listing.status !== ResaleStatus.LOCKED) {
        throw new ConflictException('Listing is no longer locked');
      }
      if (listing.buyer_id !== buyerId) {
        throw new BadRequestException('Not the buyer for this listing');
      }
      if (listing.lock_expires_at && new Date(listing.lock_expires_at) < new Date()) {
        throw new ConflictException('Purchase lock has expired');
      }

      // Verify original ticket still valid
      const oldTicket = await tx.ticket.findUnique({
        where: { id: listing.ticket_id },
        include: { event: { include: { venue: true } }, tier: true },
      });
      if (!oldTicket || oldTicket.status !== TicketStatus.VALID) {
        throw new ConflictException('Original ticket is no longer valid');
      }
      // Cancel old ticket
      await tx.ticket.update({
        where: { id: oldTicket.id },
        data: { status: TicketStatus.CANCELLED, cancelledAt: new Date() },
      });

      // Issue new ticket to buyer
      const newTicketCode = 'TKT-' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      const savedTicket = await tx.ticket.create({
        data: {
          ticketCode: newTicketCode,
          reservationId: oldTicket.reservationId,
          userId: buyerId,
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

      // Mark listing sold
      const saved = await tx.resaleListing.update({
        where: { id: listingId },
        data: {
          status: ResaleStatus.SOLD,
          soldAt: new Date(),
          newTicketId: savedTicket.id,
        },
        include: {
          originalTicket: {
            include: { event: { include: { venue: true } }, tier: true },
          },
        },
      });

      const resp = this.toResponse(saved, saved.originalTicket);
      resp.newTicketCode = newTicketCode;
      return resp;
    }, { isolationLevel: 'Serializable' });
  }

  async completePurchase(listingId: string, buyer: any): Promise<ResaleListingResponseDto> {
    // Legacy method — now requires payment first
    throw new BadRequestException(
      'Direct purchase is not allowed. Use initiateResalePayment() then confirmResalePayment() instead.',
    );
  }

    /**
     * Demo-flow: atomic lock + create COMPLETED payment + transfer ticket in one
     * SERIALIZABLE transaction. Used by the frontend's legacy "Purchase" button
     * when Stripe is not wired end-to-end. In production, callers should instead
     * lock -> initiateResalePayment -> (Stripe) -> confirmResalePayment/webhook.
     */
    async demoDirectPurchase(listingId: string, buyer: any): Promise<ResaleListingResponseDto> {
      return this.prisma.$transaction(async (tx) => {
        const [listing] = await tx.$queryRaw<any[]>`
          SELECT * FROM resale_listings WHERE id = ${listingId}::uuid FOR UPDATE
        `;
        if (!listing) throw new NotFoundException('Listing not found');
        if (listing.status !== ResaleStatus.LISTED) {
          throw new BadRequestException('Listing is not available');
        }
        if (listing.seller_id === buyer.id) {
          throw new BadRequestException('Cannot purchase your own listing');
        }

        // Lock it to this buyer
        await tx.resaleListing.update({
          where: { id: listingId },
          data: {
            status: ResaleStatus.LOCKED,
            buyerId: buyer.id,
            lockExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

        // Create a COMPLETED payment record (simulates Stripe success)
        const payment = await tx.payment.create({
          data: {
            resaleListingId: listingId,
            userId: buyer.id,
            amount: Number(listing.asking_price),
            currency: listing.currency || 'USD',
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.COMPLETED,
            providerPaymentId: `demo_${listingId}_${Date.now()}`,
            completedAt: new Date(),
          },
        });

        // Transfer ticket using the shared function
        return this.completeResaleTransfer(payment, tx);
      }, { isolationLevel: 'Serializable' });
    }

    async getUserListings(userId: string): Promise<ResaleListingResponseDto[]> {
    const listings = await this.prisma.resaleListing.findMany({
      where: { sellerId: userId },
      include: {
        originalTicket: {
          include: { event: { include: { venue: true } }, tier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return listings.map((l) => this.toResponse(l, l.originalTicket));
  }

  async cancelListing(listingId: string, user: any): Promise<void> {
    const listing = await this.prisma.resaleListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== user.id) {
      throw new BadRequestException('Not authorized');
    }
    if (listing.status === ResaleStatus.SOLD) {
      throw new BadRequestException('Cannot cancel a sold listing');
    }
    if (listing.status === ResaleStatus.LOCKED) {
      throw new BadRequestException(
        'Cannot cancel a locked listing. Buyer may be in the process of payment.',
      );
    }

    await this.prisma.resaleListing.update({
      where: { id: listingId },
      data: { status: ResaleStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireLockedListings(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.resaleListing.updateMany({
      where: {
        status: ResaleStatus.LOCKED,
        lockExpiresAt: { lt: now },
      },
      data: {
        status: ResaleStatus.LISTED,
        buyerId: null,
        lockExpiresAt: null,
      },
    });
    if (expired.count > 0) {
      this.logger.log(`Expired ${expired.count} locked resale listings`);
    }
  }

  toResponse(listing: any, ticket?: any): ResaleListingResponseDto {
    return {
      id: listing.id,
      ticketId: listing.ticketId,
      eventId: listing.eventId,
      sellerId: listing.sellerId,
      sellerName: listing.seller
        ? `${listing.seller.firstName || ''} ${listing.seller.lastName || ''}`.trim() || 'Anonymous'
        : 'Anonymous',
      askingPrice: Number(listing.askingPrice),
      originalPrice: Number(listing.originalPrice || 0),
      platformFeePercent: Number(listing.platformFeePercent || 0),
      platformFeeAmount: Number(listing.platformFeeAmount || 0),
      sellerPayout: Number(listing.sellerPayout || 0),
      currency: listing.currency,
      status: listing.status,
      eventName: ticket?.event?.name ?? null,
      eventCoverImageUrl: ticket?.event?.coverImageUrl ?? null,
      eventDate: ticket?.event?.eventDate ?? null,
      venueName: ticket?.event?.venue?.name ?? null,
      tierName: ticket?.tierName ?? ticket?.tier?.name ?? null,
      seatLabel: ticket?.seatLabel ?? null,
      buyerId: listing.buyerId ?? null,
      newTicketCode: null,
      lockExpiresAt: listing.lockExpiresAt,
      createdAt: listing.createdAt,
      soldAt: listing.soldAt,
    };
  }

  private toPaymentResponse(p: any): PaymentResponseDto {
    return {
      id: p.id,
      reservationId: p.reservationId,
      amount: Number(p.amount),
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      clientSecret: p.providerClientSecret,
      approvalUrl: null,
      checkoutUrl: null,
      completedAt: p.completedAt,
      createdAt: p.createdAt,
    };
  }
}
