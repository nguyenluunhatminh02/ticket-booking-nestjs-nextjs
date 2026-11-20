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

/**
 * Thrown inside a database transaction when an external Stripe refund is
 * required. The transaction must be allowed to roll back first; the caller
 * then performs the refund outside it. The payment id is used as an
 * idempotency key so a retried webhook cannot issue a second refund.
 */
export class ResaleRefundRequiredException extends ConflictException {
  constructor(public readonly paymentForRefund: any, message: string) {
    super(message);
  }
}

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

      // Mark payment completed, then reuse the SINGLE shared transfer path.
      // completeResaleTransfer locks the listing and is idempotent, so the
      // webhook and API-confirm paths cannot diverge or double-transfer.
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, completedAt: new Date() },
      });
      return await this.completeResaleTransfer(payment, tx);
    }, { isolationLevel: 'Serializable' });
  }

  async completePurchase(listingId: string, buyer: any): Promise<ResaleListingResponseDto> {
    // Legacy method — now requires payment first
    throw new BadRequestException(
      'Direct purchase is not allowed. Use initiateResalePayment() then confirmResalePayment() instead.',
    );
  }

  /**
   * Shared resale ticket-transfer logic. Runs inside the caller's
   * SERIALIZABLE transaction, locks the listing, cancels the original
   * ticket, issues a new one to the buyer, and marks the listing SOLD.
   *
   * Idempotent: if the listing is already SOLD, returns the existing state
   * (so concurrent webhook + API confirm cannot produce duplicate tickets).
   *
   * If the listing expired or the original ticket is no longer valid, we
   * throw ResaleRefundRequiredException so the transaction rolls back and
   * the caller issues the refund outside it (with an idempotency key).
   */
  async completeResaleTransfer(payment: any, tx: any): Promise<ResaleListingResponseDto> {
    if (!payment?.resale_listing_id) {
      throw new BadRequestException('Payment is not a resale payment');
    }
    const listingId = payment.resale_listing_id;
    const buyerId = payment.userId ?? payment.user_id;

    const [listing] = await tx.$queryRaw<any[]>`
      SELECT * FROM resale_listings WHERE id = ${listingId}::uuid FOR UPDATE
    `;
    if (!listing) throw new NotFoundException('Listing not found');

    if (listing.status === ResaleStatus.SOLD) {
      const existing = await tx.resaleListing.findUnique({
        where: { id: listingId },
        include: {
          originalTicket: { include: { event: { include: { venue: true } }, tier: true } },
          newTicket: true,
        },
      });
      const resp = this.toResponse(existing, existing.originalTicket);
      resp.newTicketCode = existing.newTicket?.ticketCode ?? null;
      return resp;
    }

    const lockExpired = listing.lock_expires_at && new Date(listing.lock_expires_at) < new Date();
    if (listing.status !== ResaleStatus.LOCKED || lockExpired) {
      throw new ResaleRefundRequiredException(
        payment,
        'Listing expired before transfer could complete; refunded',
      );
    }
    if (listing.buyer_id !== buyerId) {
      throw new BadRequestException('Payment does not belong to the locked buyer');
    }

    const oldTicket = await tx.ticket.findUnique({
      where: { id: listing.ticket_id },
      include: { event: { include: { venue: true } }, tier: true },
    });
    if (!oldTicket || oldTicket.status !== TicketStatus.VALID) {
      throw new ResaleRefundRequiredException(
        payment,
        'Original ticket is no longer valid; refunded',
      );
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

    const saved = await tx.resaleListing.update({
      where: { id: listingId },
      data: {
        status: ResaleStatus.SOLD,
        soldAt: new Date(),
        newTicketId: savedTicket.id,
      },
      include: {
        originalTicket: { include: { event: { include: { venue: true } }, tier: true } },
      },
    });

    const resp = this.toResponse(saved, saved.originalTicket);
    resp.newTicketCode = newTicketCode;
    return resp;
  }

  /**
   * Issues the Stripe refund with a deterministic idempotency key and marks
   * the payment REFUNDED in the database. Throws on failure so the caller
   * never reports a refund that did not happen. Returns false when Stripe is
   * not configured (nothing to refund).
   */
  async refundPaymentViaStripe(payment: any): Promise<boolean> {
    if (!this.stripeClient || !payment?.provider_payment_id) return false;
    try {
      // Idempotency key prevents a second refund even if the webhook is retried.
      await this.stripeClient.refunds.create(
        { payment_intent: payment.provider_payment_id },
        { idempotencyKey: `resale-refund-${payment.id}` },
      );
      // Persist the terminal state so retrying webhooks skip this payment.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUNDED, failureReason: 'Resale transfer failed; auto-refunded' },
      });
      this.logger.warn(`Auto-refunded resale payment ${payment.id}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to auto-refund payment ${payment.id}: ${err.message}`);
      throw err;
    }
  }

  async getListingDetails(listingId: string): Promise<ResaleListingResponseDto> {
    const listing = await this.prisma.resaleListing.findUnique({
      where: { id: listingId },
      include: {
        originalTicket: {
          include: { event: { include: { venue: true } }, tier: true },
        },
        seller: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return this.toResponse(listing, listing.originalTicket);
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
