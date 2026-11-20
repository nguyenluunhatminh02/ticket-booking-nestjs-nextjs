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

    let paymentIntent: any;
    try {
      paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: (reservation.currency || 'USD').toLowerCase(),
        metadata: { reservationId: dto.reservationId, userId: user.id },
        automatic_payment_methods: { enabled: true },
      });
    } catch (err: any) {
      throw new BadRequestException(`Stripe error: ${err.message}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Cancel old pending payments on Stripe before marking them failed
      const oldPayments = await tx.payment.findMany({
        where: { reservationId: dto.reservationId, status: PaymentStatus.PENDING },
      });
      for (const oldPayment of oldPayments) {
        if (oldPayment.providerPaymentId && this.stripeClient) {
          try {
            await this.stripeClient.paymentIntents.cancel(oldPayment.providerPaymentId);
          } catch (err: any) {
            this.logger.warn(`Failed to cancel Stripe PaymentIntent ${oldPayment.providerPaymentId}: ${err.message}`);
          }
        }
      }

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
    // Check if any tickets from this reservation have been resold
    const tickets = await this.prisma.ticket.findMany({
      where: { reservationId },
      select: { id: true },
    });

    const ticketIds = tickets.map((t: any) => t.id);
    if (ticketIds.length > 0) {
      const resoldTickets = await this.prisma.resaleListing.findFirst({
        where: {
          ticketId: { in: ticketIds },
          status: ResaleStatus.SOLD,
        },
      });
      if (resoldTickets) {
        throw new BadRequestException(
          'Cannot refund: one or more tickets from this reservation have been resold',
        );
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
      try {
        await this.stripeClient.refunds.create({ payment_intent: payment.providerPaymentId });
      } catch (err: any) {
        throw new BadRequestException(`Stripe refund failed: ${err.message}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<any[]>`
        SELECT * FROM payments WHERE id = ${payment.id}::uuid AND status = 'COMPLETED' FOR UPDATE
      `;
      if (!locked) {
        const current = await tx.payment.findUnique({ where: { id: payment.id } });
        return this.toResponse(current!);
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUNDED },
      });

      const reservation = await this.reservationService.getReservationEntity(reservationId, tx);
      await this.reservationService.releaseReservation(reservation, tx);

      return this.toResponse(updated);
    }, { isolationLevel: 'Serializable' });
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
    try {
      await this.prisma.$transaction(async (tx) => {
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
      }, { isolationLevel: 'Serializable' });
    } catch (err: any) {
      if (err instanceof ResaleRefundRequiredException) {
        // The transaction has rolled back; only NOW is it safe to call Stripe.
        // The payment id is used as an idempotency key to survive webhook retries.
        refundRequired = err.paymentForRefund;
      } else {
        throw err;
      }
    }

    if (refundRequired) {
      const refunded = await this.resaleService.refundPaymentViaStripe(refundRequired);
      if (refunded) {
        throw new BadRequestException('Resale transfer failed; payment refunded');
      }
      throw new BadRequestException('Resale transfer failed; refund could not be issued');
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
    try {
      await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { provider: PaymentProvider.PAYPAL, providerPaymentId: captureId, status: PaymentStatus.PENDING },
        });
        if (!payment) return;
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.COMPLETED, completedAt: new Date() },
        });
        if (payment.reservationId) {
          await this.reservationService.confirmReservation(payment.reservationId, tx);
          const reservation = await this.reservationService.getReservationEntity(payment.reservationId, tx);
          await this.ticketService.issueTicketsForReservation(reservation, tx);
        } else if ((payment as any).resale_listing_id) {
          await this.resaleService.completeResaleTransfer(payment, tx);
        }
      }, { isolationLevel: 'Serializable' });
    } catch (err: any) {
      if (err instanceof ResaleRefundRequiredException) {
        refundRequired = err.paymentForRefund;
      } else {
        throw err;
      }
    }
    if (refundRequired) {
      const refunded = await this.resaleService.refundPaymentViaStripe(refundRequired);
      if (!refunded) throw new BadRequestException('Resale transfer failed; refund could not be issued');
      throw new BadRequestException('Resale transfer failed; payment refunded');
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
