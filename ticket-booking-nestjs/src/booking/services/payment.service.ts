import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, PaymentProvider, ReservationStatus } from '../entities/enums';
import { InitiatePaymentDto } from '../dto';
import { PaymentResponseDto } from '../dto/response/payment-response.dto';
import { ReservationService } from './reservation.service';
import { TicketService } from './ticket.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripeClient: any;

  constructor(
    private prisma: PrismaService,
    private reservationService: ReservationService,
    private ticketService: TicketService,
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

  getAvailableProviders(): any[] {
    const providers = [];
    if (this.stripeClient) {
      providers.push({ provider: 'STRIPE', displayName: 'Credit/Debit Card' });
    }
    providers.push({ provider: 'PAYPAL', displayName: 'PayPal' });
    providers.push({ provider: 'PAYOS', displayName: 'Bank Transfer (VN)' });
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

      await this.reservationService.confirmReservation(payment.reservation_id, tx);
      const reservation = await this.reservationService.getReservationEntity(
        payment.reservation_id,
        tx,
      );
      await this.ticketService.issueTicketsForReservation(reservation, tx);
    }, { isolationLevel: 'Serializable' });
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
