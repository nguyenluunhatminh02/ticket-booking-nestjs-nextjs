import { BadRequestException } from '@nestjs/common';
import { PaymentStatus, ReservationStatus } from '../entities/enums';
import { PaymentService } from './payment.service';

/**
 * Webhook duplicate-delivery coverage.
 *
 * Stripe redelivers `payment_intent.succeeded` until it sees a 2xx. The service
 * must fulfill at most once: the row is claimed with SELECT ... FOR UPDATE and
 * the subsequent delivery must observe no PENDING row, so no second ticket
 * issuance / resale transfer is attempted. The signature and all external
 * effects are mocked; no Stripe account, Postgres instance, or HTTP server is
 * needed.
 */
describe('PaymentService.handleStripeWebhook - duplicate delivery', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockTx: any;
  let reservationService: any;
  let ticketService: any;
  let resaleService: any;

  const webhookEvent = {
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_duplicate', amount_received: 5000, currency: 'usd' } },
  };

  const pendingPayment = {
    id: 'pay-duplicate',
    amount: 50,
    currency: 'USD',
    status: PaymentStatus.PENDING,
    reservation_id: 'res-duplicate',
    resale_listing_id: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      payment: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    mockPrisma = {
      $transaction: jest.fn((fn: any) => fn(mockTx)),
      $executeRaw: jest.fn(),
    };
    reservationService = {
      assertReservationPayable: jest.fn().mockResolvedValue(undefined),
      confirmReservation: jest.fn().mockResolvedValue(undefined),
      getReservationEntity: jest.fn().mockResolvedValue({ id: 'res-duplicate' }),
    };
    ticketService = { issueTicketsForReservation: jest.fn().mockResolvedValue([]) };
    resaleService = {
      completeResaleTransfer: jest.fn().mockResolvedValue({}),
      refundPaymentViaStripe: jest.fn().mockResolvedValue(true),
    };
    service = new PaymentService(
      mockPrisma as any,
      reservationService as any,
      ticketService as any,
      {
        get: jest.fn((key: string) =>
          key === 'STRIPE_SECRET_KEY' ? 'sk_test_mock' : key === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_test' : null,
        ),
      } as any,
      resaleService as any,
    );
    (service as any).stripeClient = {
      webhooks: { constructEvent: jest.fn().mockReturnValue(webhookEvent) },
    };
  });

  const deliver = () => service.handleStripeWebhook('payload', 'sig');

  it('redelivery of an already-fulfilled event does not issue tickets twice', async () => {
    // First delivery claims the PENDING row and fulfills the reservation.
    mockTx.$queryRaw.mockResolvedValueOnce([pendingPayment]);
    await deliver();

    expect(mockTx.payment.update).toHaveBeenCalledTimes(1);
    expect(reservationService.confirmReservation).toHaveBeenCalledTimes(1);
    expect(ticketService.issueTicketsForReservation).toHaveBeenCalledTimes(1);

    // Second delivery: the row is no longer PENDING, so the FOR UPDATE query
    // returns nothing and the handler is a no-op.
    mockTx.$queryRaw.mockResolvedValueOnce([]);
    await expect(deliver()).resolves.toBeUndefined();

    expect(mockTx.payment.update).toHaveBeenCalledTimes(1);
    expect(reservationService.confirmReservation).toHaveBeenCalledTimes(1);
    expect(ticketService.issueTicketsForReservation).toHaveBeenCalledTimes(1);
    expect(resaleService.completeResaleTransfer).not.toHaveBeenCalled();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('redelivery of a resale webhook does not transfer the ticket twice', async () => {
    const resalePayment = {
      ...pendingPayment,
      reservation_id: null,
      resale_listing_id: 'listing-duplicate',
    };

    mockTx.$queryRaw.mockResolvedValueOnce([resalePayment]);
    await deliver();
    expect(resaleService.completeResaleTransfer).toHaveBeenCalledTimes(1);

    mockTx.$queryRaw.mockResolvedValueOnce([]);
    await deliver();

    expect(resaleService.completeResaleTransfer).toHaveBeenCalledTimes(1);
    expect(mockTx.payment.update).toHaveBeenCalledTimes(1);
    expect(ticketService.issueTicketsForReservation).not.toHaveBeenCalled();
  });

  it('a retry for an expired reservation fails closed and never fulfills it', async () => {
    // The reservation expired between checkout and webhook delivery: the
    // in-transaction guard throws, rolling back the COMPLETED update.
    reservationService.assertReservationPayable.mockRejectedValueOnce(
      new BadRequestException('Reservation has expired'),
    );
    mockTx.$queryRaw.mockResolvedValueOnce([pendingPayment]);
    // markFailedAndRefund always rejects after persisting FAILED + refunding.
    await expect(deliver()).rejects.toThrow(/payment refunded/);

    expect(mockTx.payment.update).not.toHaveBeenCalled();
    expect(reservationService.confirmReservation).not.toHaveBeenCalled();
    expect(ticketService.issueTicketsForReservation).not.toHaveBeenCalled();
    // FAILED + refund are persisted outside the rolled-back transaction.
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(resaleService.refundPaymentViaStripe).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay-duplicate' }),
    );

    // A redelivery after the refund sees no PENDING row: still no fulfillment.
    mockTx.$queryRaw.mockResolvedValueOnce([]);
    await deliver();
    expect(ticketService.issueTicketsForReservation).not.toHaveBeenCalled();
  });

  it('ignores an unrelated event type without opening a transaction', async () => {
    (service as any).stripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_duplicate' } },
    });

    await expect(deliver()).resolves.toBeUndefined();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
