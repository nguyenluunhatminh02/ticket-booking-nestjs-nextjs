import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '../entities/enums';
import { PaymentService } from './payment.service';

/**
 * Refund idempotency coverage.
 *
 * The refund flow uses two layers: a deterministic Stripe idempotency key
 * (`refund-${payment.id}`) and a DB claim marker
 * (`REFUNDING:<paymentId>:<epochMs>`) that lets only one caller cross the
 * external boundary. The claim is a conditional UPDATE whose affected-row
 * count decides ownership; on failure the caller re-reads the payment outside
 * the stale snapshot. All Stripe and Prisma calls are mocked; no live payment
 * provider or database is involved.
 */
describe('PaymentService.refundPayment - idempotency', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockTx: any;
  let reservationService: any;
  let stripeRefundCreate: jest.Mock;

  const payment = {
    id: 'pay-refund',
    reservationId: 'res-refund',
    userId: 'user-1',
    status: PaymentStatus.COMPLETED,
    amount: 100,
    currency: 'USD',
    provider: PaymentProvider.STRIPE,
    providerPaymentId: 'pi_refund',
  };

  // Prisma tagged templates pass the template's strings array as argument 0
  // and interpolated values as the remaining arguments.
  const markerArgs = (call: any[]) => call.slice(1);

  beforeEach(() => {
    jest.clearAllMocks();

    stripeRefundCreate = jest.fn().mockResolvedValue({ id: 're_1' });
    mockTx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      resaleListing: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: {
        findUnique: jest.fn().mockResolvedValue({ ...payment, status: PaymentStatus.REFUNDED }),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => ({
          ...payment,
          status: PaymentStatus.REFUNDED,
        })),
        // The in-transaction resale guard uses resaleListing as its filter;
        // other payment lookups are keyed on reservationId.
        findFirst: jest.fn().mockImplementation((args: any) =>
          Promise.resolve(args?.where?.reservationId ? payment : null),
        ),
      },
    };
    mockPrisma = {
      ticket: { findMany: jest.fn().mockResolvedValue([]) },
      resaleListing: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: {
        // Reservation-payment lookups include reservationId; the resale-guard
        // lookup filters on resaleListing instead, so key the mock on the query
        // rather than on call order.
        findFirst: jest.fn().mockImplementation((args: any) =>
          Promise.resolve(args?.where?.reservationId ? payment : null),
        ),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(mockTx)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    reservationService = {
      getReservationEntity: jest.fn().mockResolvedValue({ id: 'res-refund' }),
      releaseReservation: jest.fn().mockResolvedValue(undefined),
    };
    service = new PaymentService(
      mockPrisma as any,
      reservationService as any,
      { issueTicketsForReservation: jest.fn() } as any,
      {
        get: jest.fn((key: string) => (key === 'STRIPE_SECRET_KEY' ? 'sk_test_mock' : null)),
      } as any,
      { completeResaleTransfer: jest.fn() } as any,
    );
    (service as any).stripeClient = { refunds: { create: stripeRefundCreate } };
  });

  const refund = () => service.refundPayment('res-refund', 'user-1');

  it('uses a deterministic Stripe idempotency key derived from the payment id', async () => {
    const result = await refund();

    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(stripeRefundCreate).toHaveBeenCalledTimes(1);
    expect(stripeRefundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_refund' },
      { idempotencyKey: 'refund-pay-refund' },
    );
    // The claim UPDATE stamps the marker with a timestamp, and finalization
    // matches that exact marker. No external call is made inside either tx.
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(markerArgs(mockTx.$executeRaw.mock.calls[0])).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^REFUNDING:pay-refund:\d+$/),
      ]),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    expect(reservationService.releaseReservation).toHaveBeenCalledTimes(1);
  });

  it('a second caller holding the in-flight claim is rejected before any Stripe call', async () => {
    // The conditional claim UPDATE affects no rows and the fresh-state read
    // sees the other caller's in-flight marker.
    mockTx.$executeRaw.mockResolvedValueOnce(0);
    mockPrisma.payment.findUnique.mockResolvedValue({
      ...payment,
      failureReason: 'REFUNDING:pay-refund:1700000000000',
    });

    await expect(refund()).rejects.toThrow('Refund already in progress');
    expect(stripeRefundCreate).not.toHaveBeenCalled();
    expect(reservationService.releaseReservation).not.toHaveBeenCalled();
  });

  it('reclaims a stale in-flight marker older than the safe threshold', async () => {
    // A crash before finalization left a marker behind. The next caller must
    // be able to claim the row again; the fixed Stripe key still prevents a
    // double refund.
    mockTx.$executeRaw.mockImplementation((strings: TemplateStringsArray) => 1);

    const result = await refund();

    expect(result.status).toBe(PaymentStatus.REFUNDED);
    const claimSql = mockTx.$executeRaw.mock.calls[0][0].raw.join('?');
    expect(claimSql).toContain('failure_reason <');
    expect(stripeRefundCreate).toHaveBeenCalledTimes(1);
    expect(reservationService.releaseReservation).toHaveBeenCalledTimes(1);
  });

  it('a caller that lost the race to an already-finished refund returns it idempotently', async () => {
    mockPrisma.payment.findFirst.mockImplementation((args: any) =>
      Promise.resolve(args?.where?.reservationId ? { ...payment, status: PaymentStatus.REFUNDED } : null),
    );

    const result = await refund();
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(stripeRefundCreate).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('a refund finalized after the initial read is returned idempotently from the fresh-state check', async () => {
    // The initial read still sees COMPLETED and the claim UPDATE affects no
    // rows: another caller won and finalized. The fresh-state read outside the
    // stale snapshot must return the finished refund without another reversal.
    mockTx.$executeRaw.mockResolvedValueOnce(0);
    mockPrisma.payment.findUnique.mockResolvedValue({ ...payment, status: PaymentStatus.REFUNDED });

    const result = await refund();
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(stripeRefundCreate).not.toHaveBeenCalled();
    expect(reservationService.releaseReservation).not.toHaveBeenCalled();
  });

  it('a Stripe failure clears the in-flight marker and never releases the reservation', async () => {
    stripeRefundCreate.mockRejectedValueOnce(new Error('stripe unavailable'));

    await expect(refund()).rejects.toThrow('Stripe refund failed');

    // One claim UPDATE plus the conditional failure-clear UPDATE using the
    // same timestamped marker; no finalization transaction runs.
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(markerArgs(mockPrisma.$executeRaw.mock.calls[0])).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^REFUNDING:pay-refund:\d+$/),
      ]),
    );
    expect(stripeRefundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_refund' },
      { idempotencyKey: 'refund-pay-refund' },
    );
    expect(reservationService.releaseReservation).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('cannot refund a reservation whose tickets were resold', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'tk-1' }]);
    // The initial guard does not see the listing, but the re-check after the
    // claim row lock does; only that qualified check can stop the refund here.
    mockPrisma.resaleListing.findFirst.mockResolvedValue(null);
    mockTx.resaleListing.findFirst.mockResolvedValue({ id: 'listing-1' });

    await expect(refund()).rejects.toThrow(
      'Cannot refund: one or more tickets have an active resale listing or pending resale payment',
    );
    expect(mockTx.resaleListing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticketId: { in: ['tk-1'] },
          status: { in: expect.arrayContaining(['LISTED', 'LOCKED', 'SOLD']) },
        }),
      }),
    );
    expect(stripeRefundCreate).not.toHaveBeenCalled();
    expect(reservationService.releaseReservation).not.toHaveBeenCalled();
  });

  it('cannot refund when a ticket has a LISTED or LOCKED resale listing', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'tk-1' }, { id: 'tk-2' }]);
    mockPrisma.resaleListing.findFirst.mockResolvedValue(null);
    mockTx.resaleListing.findFirst.mockResolvedValue({ id: 'listing-1' });

    await expect(refund()).rejects.toThrow(
      'Cannot refund: one or more tickets have an active resale listing or pending resale payment',
    );
    expect(mockTx.resaleListing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ticketId: { in: ['tk-1', 'tk-2'] },
          status: { in: expect.arrayContaining(['LISTED', 'LOCKED', 'SOLD']) },
        }),
      }),
    );
    expect(stripeRefundCreate).not.toHaveBeenCalled();
  });

  it('cannot refund when a resale listing has a PENDING payment', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'tk-1' }]);
    // No active listing row, but an in-flight resale payment references one of
    // the reservation's tickets through its resaleListingId.
    mockPrisma.resaleListing.findFirst.mockResolvedValueOnce(null);
    mockTx.payment.findFirst.mockImplementation((args: any) =>
      Promise.resolve(
        args?.where?.reservationId
          ? payment
          : { id: 'resale-pay-1', status: PaymentStatus.PENDING },
      ),
    );

    await expect(refund()).rejects.toThrow(
      'Cannot refund: one or more tickets have an active resale listing or pending resale payment',
    );
    expect(mockTx.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PaymentStatus.PENDING,
          resaleListing: { ticketId: { in: ['tk-1'] } },
        }),
      }),
    );
    expect(stripeRefundCreate).not.toHaveBeenCalled();
  });

  it('rejects a resale listing created between the initial guard and the claim lock', async () => {
    // The outside-transaction check sees no resale activity, but another
    // transaction creates a listing before this caller acquires the payment
    // row lock inside the claim transaction. The in-transaction re-check must
    // throw before Stripe is called.
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 'tk-1' }]);
    mockPrisma.resaleListing.findFirst.mockResolvedValue(null);
    mockTx.resaleListing.findFirst.mockResolvedValue({ id: 'listing-race' });

    await expect(refund()).rejects.toThrow(
      'Cannot refund: one or more tickets have an active resale listing or pending resale payment',
    );
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(stripeRefundCreate).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('fails when no completed payment exists', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    await expect(refund()).rejects.toThrow(NotFoundException);
    expect(stripeRefundCreate).not.toHaveBeenCalled();
  });
});
