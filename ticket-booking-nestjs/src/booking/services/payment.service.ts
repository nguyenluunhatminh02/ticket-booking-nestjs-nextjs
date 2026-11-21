import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, PaymentProvider, ReservationStatus, ResaleStatus } from '../entities/enums';
import { InitiatePaymentDto } from '../dto';
import { PaymentResponseDto } from '../dto/response/payment-response.dto';
import { ReservationService } from './reservation.service';
import { TicketService } from './ticket.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ResaleService, ResaleRefundRequiredException } from './resale.service';
import { runSerializableTransaction } from './prisma-transaction-retry';
import { v4 as uuidv4 } from 'uuid';

/** Signals that a paid webhook arrived for a reservation that can no longer be fulfilled. */
class ReservationNotPayableException extends Error {
  constructor(
    readonly payment: any,
    readonly reason: string,
  ) {
    super(reason);
  }
}

/**
 * Aborts a claim transaction after learning that another caller owns the
 * refund. This must not inherit from a retryable database error: the outer
 * handler converts it into a fresh-state read outside the stale snapshot.
 */
class RefundClaimLostException extends Error {
  constructor() {
    super('Refund claim lost');
  }
}

/** How long a REFUNDING marker may remain before another caller may reclaim it. */
const REFUND_CLAIM_STALE_MS = 10 * 60 * 1000;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripeClient: any;

  constructor(
    private prisma: PrismaService,
    private reservationService: ReservationService,
    private ticketService: TicketService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ResaleService))
    private resaleService: ResaleService,
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

  /**
   * Verify the reservation is still payable inside the webhook transaction.
   * Delegates to the tx-scoped validator when available; the fallback keeps
   * compatibility with lightweight unit-test doubles that only expose the
   * existing getReservationEntity seam.
   */
  private async assertReservationPayableForWebhook(reservationId: string, tx: any): Promise<void> {
    const validator = (this.reservationService as any).assertReservationPayable;
    if (typeof validator === 'function') {
      await validator.call(this.reservationService, reservationId, tx);
      return;
    }
    const reservation = await this.reservationService.getReservationEntity(reservationId, tx);
    if (!reservation) {
      throw new BadRequestException('Reservation not found');
    }
    if (reservation.status !== undefined && reservation.status !== null &&
        String(reservation.status) !== ReservationStatus.PENDING) {
      throw new BadRequestException('Reservation is not pending');
    }
    if (reservation.expiresAt) {
      const expiresAt = new Date(reservation.expiresAt).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw new BadRequestException('Reservation has expired');
      }
    }
  }

  getAvailableProviders(): any[] {
    // Only advertise providers that can actually initiate and confirm a payment.
    // PayPal/PayOS are not implemented yet, so exposing them here sends users
    // into a checkout flow that is guaranteed to be rejected.
    const providers = [];
    if (this.stripeClient) {
      providers.push({ provider: 'STRIPE', displayName: 'Credit/Debit Card' });
    }
    return providers;
  }

  async initiatePayment(dto: InitiatePaymentDto, user: any): Promise<PaymentResponseDto> {
    const reservation = await this.reservationService.getReservationEntity(dto.reservationId);
    if (reservation.userId !== user.id) throw new BadRequestException('Not authorized');
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Reservation cannot be paid');
    }
    if (reservation.expiresAt && new Date(reservation.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Reservation has expired');
    }

    const amount = Number(reservation.totalAmount) - Number(reservation.discountAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }

    if (dto.provider === PaymentProvider.PAYPAL || dto.provider === PaymentProvider.PAYOS) {
      throw new BadRequestException(`${dto.provider} payment is not yet available. Please use another payment method.`);
    }
    if (dto.provider !== PaymentProvider.STRIPE) {
      throw new BadRequestException('Unsupported payment provider');
    }
    if (!this.stripeClient) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Cancel old pending payments on Stripe BEFORE opening the transaction.
    // External API calls must not run inside a DB transaction to avoid holding
    // locks while waiting for network I/O.
    const oldPayments = await this.prisma.payment.findMany({
      where: { reservationId: dto.reservationId, status: PaymentStatus.PENDING },
    });
    for (const oldPayment of oldPayments) {
      if (oldPayment.providerPaymentId) {
        try {
          await this.stripeClient.paymentIntents.cancel(oldPayment.providerPaymentId);
        } catch (err: any) {
          this.logger.warn(`Failed to cancel Stripe PaymentIntent ${oldPayment.providerPaymentId}: ${err.message}`);
        }
      }
    }

    // Use a fresh key for each new initiation attempt. This prevents Stripe
    // from replaying a cancelled PaymentIntent when the user pays again, while
    // a stable attempt token (when supplied) survives a retry of one API call.
    const attemptToken = (dto as any).attemptToken;
    const idempotencyKey = `reservation-init-${dto.reservationId}-${
      typeof attemptToken === 'string' && attemptToken.trim()
        ? attemptToken
        : uuidv4()
    }`;
    let paymentIntent: any;
    try {
      paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: (reservation.currency || 'USD').toLowerCase(),
        metadata: { reservationId: dto.reservationId, userId: user.id, idempotencyKey },
        automatic_payment_methods: { enabled: true },
      }, {
        idempotencyKey,
      });
    } catch (err: any) {
      throw new BadRequestException(`Stripe error: ${err.message}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark old pending payments as failed in DB (Stripe cancellation already done above)
      await tx.payment.updateMany({
        where: { reservationId: dto.reservationId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: 'Replaced by new payment' },
      });

      await this.reservationService.extendExpiry(reservation, 30, tx);

      const saved = await tx.payment.create({
        data: {
          reservationId: dto.reservationId,
          userId: user.id,
          amount,
          currency: reservation.currency || 'USD',
          provider: dto.provider,
          status: PaymentStatus.PENDING,
          providerPaymentId: paymentIntent.id,
          providerClientSecret: paymentIntent.client_secret,
        },
      });
      return this.toResponse(saved);
    }, { isolationLevel: 'Serializable' });
  }

  async getPaymentStatus(reservationId: string, userId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== userId) throw new BadRequestException('Not authorized');
    return this.toResponse(payment);
  }

  async confirmStripePayment(
    paymentIntentId: string,
    reservationId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { reservationId, providerPaymentId: paymentIntentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== userId) throw new BadRequestException('Not authorized');

    if (payment.status === PaymentStatus.COMPLETED) {
      return this.toResponse(payment);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment cannot be confirmed in current state');
    }
    if (!this.stripeClient) {
      throw new BadRequestException('Stripe is not configured');
    }

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
    if (intent.metadata?.reservationId && intent.metadata.reservationId !== reservationId) {
      throw new BadRequestException('Payment does not belong to this reservation');
    }

    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<any[]>`
        SELECT * FROM payments WHERE id = ${payment.id}::uuid AND status = 'PENDING' FOR UPDATE
      `;
      if (!locked) {
        const current = await tx.payment.findUnique({ where: { id: payment.id } });
        return this.toResponse(current!);
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, completedAt: new Date() },
      });

      await this.reservationService.confirmReservation(reservationId, tx);
      const reservation = await this.reservationService.getReservationEntity(reservationId, tx);
      await this.ticketService.issueTicketsForReservation(reservation, tx);

      return this.toResponse(updated);
    }, { isolationLevel: 'Serializable' });
  }

  async refundPayment(reservationId: string, userId: string): Promise<PaymentResponseDto> {
    // A refund must never race a resale: the original ticket may still be
    // listed/locked (the listing would outlive its ticket), or a buyer may
    // already have a pending payment for one of those listings.
    const RESALE_REFUND_ERROR =
      'Cannot refund: one or more tickets have an active resale listing or pending resale payment';
    const tickets = await this.prisma.ticket.findMany({
      where: { reservationId },
      select: { id: true },
    });

    const ticketIds = tickets.map((t: any) => t.id);
    if (ticketIds.length > 0) {
      const blockingListing = await this.prisma.resaleListing.findFirst({
        where: {
          ticketId: { in: ticketIds },
          status: {
            in: [ResaleStatus.LISTED, ResaleStatus.LOCKED, ResaleStatus.SOLD],
          },
        },
        select: { id: true },
      });
      // A PENDING payment whose resaleListingId points at one of the
      // reservation's listings means a resale is still in flight.
      const pendingResalePayment = blockingListing
        ? null
        : await this.prisma.payment.findFirst({
            where: {
              status: PaymentStatus.PENDING,
              resaleListing: {
                ticketId: { in: ticketIds },
              },
            },
            select: { id: true },
          });
      if (blockingListing || pendingResalePayment) {
        throw new BadRequestException(RESALE_REFUND_ERROR);
      }
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        reservationId,
        status: { in: [PaymentStatus.COMPLETED, PaymentStatus.REFUNDED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('Completed payment not found');
    if (payment.userId !== userId) throw new BadRequestException('Not authorized');
    if (payment.status === PaymentStatus.REFUNDED) {
      return this.toResponse(payment);
    }

    if (payment.provider === PaymentProvider.STRIPE && payment.providerPaymentId) {
      if (!this.stripeClient) throw new BadRequestException('Stripe is not configured');
    }

    // Phase 1: atomically claim the payment. Repeating a SELECT under
    // SERIALIZABLE would reuse the same snapshot and still see COMPLETED,
    // letting a second caller overwrite an existing REFUNDING marker. A single
    // conditional UPDATE takes the row lock itself; its row count tells us
    // whether this caller won. The marker lives in failure_reason because the
    // DB enum has no REFUNDING value. It embeds the claim time so a crash after
    // Stripe succeeded but before finalization can be reclaimed later; the
    // deterministic Stripe key still prevents a double refund. No external call
    // is made here.
    const inFlightReason = this.refundInFlightReason(payment.id);
    const staleBefore = `REFUNDING:${payment.id}:${Date.now() - REFUND_CLAIM_STALE_MS}`;
    let claimed = false;
    // Concurrent SERIALIZABLE writers can abort with a serialization failure
    // instead of blocking; retrying re-reads the freshly committed state.
    await runSerializableTransaction(this.prisma, async (tx) => {
      const updatedRows = await tx.$executeRaw`
        UPDATE payments
        SET failure_reason = ${inFlightReason}
        WHERE id = ${payment.id}::uuid
          AND status = 'COMPLETED'
          AND (
            failure_reason IS NULL
            OR failure_reason NOT LIKE 'REFUNDING:%'
            OR failure_reason = ${`REFUNDING:${payment.id}`}
            OR (
              failure_reason LIKE ${`REFUNDING:${payment.id}:%`}
              AND failure_reason < ${staleBefore}
            )
          )
      `;
      if (updatedRows > 0) {
        // Re-check resale state inside the transaction after acquiring the row
        // lock. This closes the TOCTOU gap: between the initial check and now,
        // another transaction could have created a resale listing or payment.
        if (ticketIds.length > 0) {
          const blockingListing = await tx.resaleListing.findFirst({
            where: {
              ticketId: { in: ticketIds },
              status: {
                in: [ResaleStatus.LISTED, ResaleStatus.LOCKED, ResaleStatus.SOLD],
              },
            },
            select: { id: true },
          });
          const pendingResalePayment = blockingListing
            ? null
            : await tx.payment.findFirst({
                where: {
                  status: PaymentStatus.PENDING,
                  resaleListing: {
                    ticketId: { in: ticketIds },
                  },
                },
                select: { id: true },
              });
          if (blockingListing || pendingResalePayment) {
            throw new BadRequestException(RESALE_REFUND_ERROR);
          }
        }
        claimed = true;
        return;
      }
      // Nothing claimed: abort this snapshot before inspecting the row. A
      // repeating read inside it cannot see the other refund's commit, and a
      // raw row would use snake_case keys instead of DTO property names.
      throw new RefundClaimLostException();
    }, { logger: this.logger, label: 'Refund claim' }).catch((err: any) => {
      if (!(err instanceof RefundClaimLostException)) throw err;
    });

    if (!claimed) {
      // Outside the locked snapshot, read the authoritative current state.
      const current = await this.prisma.payment.findUnique({ where: { id: payment.id } });
      if (!current) {
        throw new NotFoundException('Payment not found');
      }
      if (current.status === PaymentStatus.REFUNDED) {
        return this.toResponse(current); // Finished by a concurrent refund.
      }
      throw new BadRequestException('Refund already in progress');
    }

    // Phase 2: call Stripe outside any database transaction. The deterministic
    // idempotency key makes retries safe if the caller times out mid-refund.
    if (payment.provider === PaymentProvider.STRIPE && payment.providerPaymentId) {
      try {
        await this.stripeClient.refunds.create(
          { payment_intent: payment.providerPaymentId },
          { idempotencyKey: `refund-${payment.id}` },
        );
      } catch (err: any) {
        await this.prisma.$executeRaw`
          UPDATE payments
          SET status = 'COMPLETED', failure_reason = ${`Stripe refund failed: ${err.message}`.slice(0, 500)}
          WHERE id = ${payment.id}::uuid AND failure_reason = ${inFlightReason}
        `;
        throw new BadRequestException(`Stripe refund failed: ${err.message}`);
      }
    }

    // Phase 3: finalize in a second transaction; release the reservation only
    // after the refund actually succeeded and the claim is still ours. A
    // conditional UPDATE re-checks both the status and our marker atomically;
    // a repeating SELECT would keep the stale snapshot under SERIALIZABLE.
    return runSerializableTransaction(this.prisma, async (tx) => {
      const finalizedRows = await tx.$executeRaw`
        UPDATE payments
        SET status = 'REFUNDED'
        WHERE id = ${payment.id}::uuid
          AND status = 'COMPLETED'
          AND failure_reason = ${inFlightReason}
      `;
      if (finalizedRows === 0) {
        const current = await tx.payment.findUnique({ where: { id: payment.id } });
        return this.toResponse(current!);
      }

      const updated = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

      const reservation = await this.reservationService.getReservationEntity(reservationId, tx);
      await this.reservationService.releaseReservation(reservation, tx);

      return this.toResponse(updated);
    }, { logger: this.logger, label: 'Refund finalization' });
  }

  /** Builds a marker carrying the claim timestamp for stale-claim recovery. */
  private refundInFlightReason(paymentId: string): string {
    return `REFUNDING:${paymentId}:${Date.now()}`;
  }

  /**
   * Persist the terminal FAILED state after the transaction rolled back, then
   * refund via Stripe outside any transaction. Stripe idempotency keys make
   * webhook retries safe.
   */
  private async markFailedAndRefund(payment: any, reason: string): Promise<void> {
    // PayPal captures are not Stripe payment intents. Calling the Stripe
    // refund API with a PayPal capture id always fails, so require a manual
    // refund instead. Stripe behavior stays unchanged.
    const isPaypal =
      payment?.provider === PaymentProvider.PAYPAL ||
      payment?.provider_payment_method === PaymentProvider.PAYPAL;
    const manualRefundReason = 'Reservation not payable; manual PayPal refund required';
    const persistedReason = isPaypal ? manualRefundReason : reason;
    await this.prisma.$executeRaw`
      UPDATE payments
      SET status = 'FAILED', failure_reason = ${persistedReason.slice(0, 500)}
      WHERE id = ${payment.id}::uuid AND status = 'PENDING'
    `;
    if (isPaypal) {
      this.logger.warn(`Manual PayPal refund required for payment ${payment.id}: ${reason}`);
      throw new BadRequestException(`${reason}; manual PayPal refund required`);
    }
    const refunded = await this.resaleService.refundPaymentViaStripe(payment);
    if (refunded) {
      throw new BadRequestException(`${reason}; payment refunded`);
    }
    throw new BadRequestException(`${reason}; refund could not be issued`);
  }

  async handleStripeWebhook(payload: string, sigHeader: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripeClient || !webhookSecret || webhookSecret.startsWith('your-')) {
      throw new BadRequestException('Stripe webhook is not configured');
    }

    let event: any;
    try {
      event = this.stripeClient.webhooks.constructEvent(payload, sigHeader, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type !== 'payment_intent.succeeded') return;

    const pi = event.data.object;
    let refundRequired: any = null;
    let refundReason = 'Resale transfer failed';
    try {
      await runSerializableTransaction(this.prisma, async (tx) => {
        const [payment] = await tx.$queryRaw<any[]>`
          SELECT * FROM payments WHERE provider_payment_id = ${pi.id} AND status = 'PENDING' FOR UPDATE
        `;
        if (!payment) return;

        const expectedAmount = Math.round(Number(payment.amount) * 100);
        if (
          pi.amount_received !== expectedAmount ||
          pi.currency !== String(payment.currency || 'USD').toLowerCase()
        ) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED, failureReason: 'Webhook amount mismatch' },
          });
          this.logger.error(`Webhook amount mismatch for payment ${payment.id}`);
          return;
        }

        // Re-check the reservation under the transaction lock. A delayed or
        // retried webhook must never fulfill a reservation that expired or was
        // cancelled in the meantime.
        if (payment.reservation_id) {
          try {
            await this.assertReservationPayableForWebhook(payment.reservation_id, tx);
          } catch (err: any) {
            const reason = `Reservation no longer payable: ${err.message}`.slice(0, 500);
            this.logger.warn(`Webhook ${reason} for payment ${payment.id}`);
            // Throwing rolls back the tx; the catch block persists FAILED and
            // issues the Stripe refund after the transaction has ended.
            throw new ReservationNotPayableException(payment, reason);
          }
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.COMPLETED, completedAt: new Date() },
        });

        // Fulfill the payment according to its type. completeResaleTransfer is
        // idempotent, so concurrent webhooks / API confirms for the same listing
        // cannot produce duplicate tickets.
        if (payment.resale_listing_id) {
          await this.resaleService.completeResaleTransfer(payment, tx);
        } else if (payment.reservation_id) {
          await this.reservationService.confirmReservation(payment.reservation_id, tx);
          const reservation = await this.reservationService.getReservationEntity(
            payment.reservation_id,
            tx,
          );
          await this.ticketService.issueTicketsForReservation(reservation, tx);
        }
      }, { logger: this.logger, label: 'Stripe webhook' });
    } catch (err: any) {
      if (err instanceof ReservationNotPayableException) {
        // Transaction rolled back; persist FAILED and refund outside it.
        await this.markFailedAndRefund(err.payment, err.reason);
      } else if (err instanceof ResaleRefundRequiredException) {
        // The transaction has rolled back; only NOW is it safe to call Stripe.
        // The payment id is used as an idempotency key to survive webhook retries.
        refundRequired = err.paymentForRefund;
        refundReason = err.message;
      } else {
        throw err;
      }
    }

    if (refundRequired) {
      const refunded = await this.resaleService.refundPaymentViaStripe(refundRequired);
      if (refunded) {
        throw new BadRequestException(`${refundReason}; payment refunded`);
      }
      throw new BadRequestException(`${refundReason}; refund could not be issued`);
    }
  }

  private paypalToken: { value: string; expiresAt: number } | null = null;

  /**
   * Verifies a PayPal webhook through PayPal's verification API and marks
   * the corresponding PENDING payment as COMPLETED. This endpoint did not
   * exist before; the frontend proxy used to receive a 404 from the backend.
   */
  async handlePaypalWebhook(payload: string, headers: Record<string, string>): Promise<void> {
    // Validate the unauthenticated request BEFORE any outbound network call.
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      throw new BadRequestException('Invalid PayPal webhook payload');
    }
    if (!event || typeof event !== 'object' || !event.event_type || !event.resource) {
      throw new BadRequestException('Invalid PayPal webhook payload');
    }
    const requiredHeaders = [
      'paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id',
      'paypal-transmission-sig', 'paypal-transmission-time',
    ];
    if (requiredHeaders.some((h) => !headers?.[h])) {
      throw new BadRequestException('Missing PayPal verification headers');
    }

    const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('PayPal webhook is not configured');
    }

    // Never send credentials to an arbitrary host configured via env.
    const configured = this.configService.get<string>('PAYPAL_API_URL') ||
      'https://api-m.sandbox.paypal.com';
    let apiBase: URL;
    try {
      apiBase = new URL(configured);
    } catch {
      throw new BadRequestException('Invalid PayPal API URL');
    }
    const host = apiBase.hostname.toLowerCase();
    if (apiBase.protocol !== 'https:' || !(host === 'api.paypal.com' || host.endsWith('.paypal.com'))) {
      throw new BadRequestException('Invalid PayPal API URL');
    }
    const base = apiBase.origin;

    const accessToken = await this.getPaypalAccessToken(base, clientId, clientSecret);

    // Ask PayPal to verify the transmitted signature.
    const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.configService.get<string>('PAYPAL_WEBHOOK_ID'),
        webhook_event: event,
      }),
    });
    if (!verifyRes.ok) {
      this.logger.error(`PayPal verification failed: ${verifyRes.status}`);
      throw new BadRequestException('PayPal webhook verification failed');
    }
    const verify = await verifyRes.json() as { verification_status?: string };
    if (verify.verification_status !== 'SUCCESS') {
      this.logger.warn(`PayPal verification status: ${verify.verification_status}`);
      throw new BadRequestException('Invalid PayPal webhook signature');
    }

    // Process only successful capture events.
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return;
    const captureId = event.resource?.id || event.resource?.supplementary_data?.related_ids?.order_id;
    if (!captureId) return;

    let refundRequired: any = null;
    let refundReason = 'Resale transfer failed';
    try {
      await runSerializableTransaction(this.prisma, async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { provider: PaymentProvider.PAYPAL, providerPaymentId: captureId, status: PaymentStatus.PENDING },
        });
        if (!payment) return;

        // Re-check the reservation under the transaction lock before fulfilling.
        if (payment.reservationId) {
          try {
            await this.assertReservationPayableForWebhook(payment.reservationId, tx);
          } catch (err: any) {
            const reason = `Reservation no longer payable: ${err.message}`.slice(0, 500);
            this.logger.warn(`Webhook ${reason} for payment ${payment.id}`);
            throw new ReservationNotPayableException(payment, reason);
          }
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.COMPLETED, completedAt: new Date() },
        });
        if (payment.reservationId) {
          await this.reservationService.confirmReservation(payment.reservationId, tx);
          const reservation = await this.reservationService.getReservationEntity(payment.reservationId, tx);
          await this.ticketService.issueTicketsForReservation(reservation, tx);
        } else if (payment.resaleListingId) {
          await this.resaleService.completeResaleTransfer(payment, tx);
        }
      }, { logger: this.logger, label: 'PayPal webhook' });
    } catch (err: any) {
      if (err instanceof ReservationNotPayableException) {
        await this.markFailedAndRefund(err.payment, err.reason);
      } else if (err instanceof ResaleRefundRequiredException) {
        refundRequired = err.paymentForRefund;
        refundReason = err.message;
      } else {
        throw err;
      }
    }
    if (refundRequired) {
      const refunded = await this.resaleService.refundPaymentViaStripe(refundRequired);
      if (!refunded) throw new BadRequestException(`${refundReason}; refund could not be issued`);
      throw new BadRequestException(`${refundReason}; payment refunded`);
    }
  }

  private async getPaypalAccessToken(base: string, clientId: string, clientSecret: string): Promise<string> {
    const now = Date.now();
    if (this.paypalToken && this.paypalToken.expiresAt > now + 60_000) {
      return this.paypalToken.value;
    }
    const authRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });
    if (!authRes.ok) {
      this.logger.error(`PayPal token request failed: ${authRes.status}`);
      throw new BadRequestException('PayPal webhook verification failed');
    }
    const auth = await authRes.json() as { access_token?: string; expires_in?: number };
    if (!auth.access_token) throw new BadRequestException('PayPal webhook verification failed');
    this.paypalToken = {
      value: auth.access_token,
      expiresAt: now + ((auth.expires_in ?? 3600) * 1000),
    };
    return auth.access_token;
  }

  toResponse(p: any): PaymentResponseDto {
    return {
      id: p.id,
      reservationId: p.reservationId,
      amount: Number(p.amount),
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      clientSecret: p.providerClientSecret,
      approvalUrl:
        p.provider === 'PAYPAL' && p.status === PaymentStatus.PENDING
          ? `https://www.sandbox.paypal.com/checkoutnow?token=${p.providerPaymentId}`
          : null,
      checkoutUrl:
        p.provider === 'PAYOS' && p.status === PaymentStatus.PENDING
          ? `https://pay.payos.vn/web/${p.providerPaymentId}`
          : null,
      completedAt: p.completedAt,
      createdAt: p.createdAt,
    };
  }
}
