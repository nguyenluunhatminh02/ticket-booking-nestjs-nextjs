import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResaleStatus, TicketStatus } from '../entities/enums';
import { ResaleService, ResaleRefundRequiredException } from './resale.service';

/**
 * Concurrent resale transfer coverage using mocked SERIALIZABLE transactions.
 *
 * `completeResaleTransfer` is the single shared transfer path for the API
 * confirm and webhook paths. Two callers racing for the same listing must
 * produce exactly one new ticket: the first sees a LOCKED listing and
 * transfers; the second (after the first commits) sees SOLD and returns the
 * existing state without creating another ticket. No Postgres/Stripe required.
 */
describe('ResaleService.completeResaleTransfer - concurrent idempotency', () => {
  let service: ResaleService;
  let mockPrisma: any;
  let mockTx: any;

  const payment = {
    id: 'pay-resale',
    resale_listing_id: 'listing-1',
    userId: 'buyer-1',
    provider_payment_id: 'pi_resale',
  };

  const lockedRow = {
    id: 'listing-1',
    status: ResaleStatus.LOCKED,
    buyer_id: 'buyer-1',
    ticket_id: 'ticket-1',
    lock_expires_at: new Date(Date.now() + 600_000),
    asking_price: 60,
    currency: 'USD',
  };

  const oldTicket = {
    id: 'ticket-1',
    reservationId: 'res-1',
    eventId: 'event-1',
    tierId: 'tier-1',
    seatId: 'seat-1',
    userId: 'seller-1',
    status: TicketStatus.VALID,
    tierName: 'VIP',
    seatLabel: 'A-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTx = {
      $queryRaw: jest.fn(),
      payment: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
      ticket: {
        findUnique: jest.fn().mockResolvedValue(oldTicket),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'new-ticket-1', ...data }),
        ),
      },
      resaleListing: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...lockedRow,
          status: ResaleStatus.SOLD,
          newTicketId: 'new-ticket-1',
          originalTicket: oldTicket,
        }),
      },
    };
    mockPrisma = {
      payment: {
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(mockTx)),
    };
    service = new ResaleService(
      mockPrisma as any,
      { get: jest.fn().mockReturnValue(null) } as any,
    );
  });

  const transfer = () => service.completeResaleTransfer(payment, mockTx);

  it('two concurrent fulfillments create exactly one ticket (SOLD guard)', async () => {
    // Caller A acquires the listing lock while it is still LOCKED.
    mockTx.$queryRaw.mockResolvedValueOnce([lockedRow]);
    const first = await transfer();

    expect(mockTx.ticket.create).toHaveBeenCalledTimes(1);
    expect(mockTx.resaleListing.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: ResaleStatus.SOLD }) }),
    );
    expect(first.newTicketCode).toMatch(/^TKT-[0-9A-F]{32}$/);

    // Caller B obtains the lock after A committed: listing is SOLD, so it
    // returns the existing state and performs no writes.
    mockTx.$queryRaw.mockResolvedValueOnce([{ ...lockedRow, status: ResaleStatus.SOLD }]);
    mockTx.resaleListing.findUnique.mockResolvedValue({
      ...lockedRow,
      status: ResaleStatus.SOLD,
      originalTicket: oldTicket,
      newTicket: { ticketCode: first.newTicketCode },
    });

    const second = await transfer();

    expect(second.newTicketCode).toBe(first.newTicketCode);
    expect(mockTx.ticket.create).toHaveBeenCalledTimes(1);
    expect(mockTx.ticket.update).toHaveBeenCalledTimes(1);
    expect(mockTx.resaleListing.update).toHaveBeenCalledTimes(1);
  });

  it('a transfer after the lock expired requires a refund and writes nothing', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([
      { ...lockedRow, lock_expires_at: new Date(Date.now() - 60_000) },
    ]);

    await expect(transfer()).rejects.toThrow(ResaleRefundRequiredException);
    expect(mockTx.ticket.findUnique).not.toHaveBeenCalled();
    expect(mockTx.ticket.create).not.toHaveBeenCalled();
  });

  it('a missing listing fails loudly instead of issuing a ticket', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([]);
    await expect(transfer()).rejects.toThrow(NotFoundException);
    expect(mockTx.ticket.create).not.toHaveBeenCalled();
  });

  it('a buyer mismatch fails before mutating either ticket', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([{ ...lockedRow, buyer_id: 'other-buyer' }]);
    await expect(transfer()).rejects.toThrow(/does not belong to the locked buyer/);
    expect(mockTx.ticket.update).not.toHaveBeenCalled();
    expect(mockTx.ticket.create).not.toHaveBeenCalled();
  });

  it('confirms a PENDING payment by delegating to the same idempotent path', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'pay-resale',
      resale_listing_id: 'listing-1',
      userId: 'buyer-1',
      status: 'PENDING',
      amount: 60,
      currency: 'USD',
    });
    (service as any).stripeClient = {
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          status: 'succeeded',
          amount_received: 6000,
          currency: 'usd',
        }),
      },
    };
    mockTx.$queryRaw
      .mockResolvedValueOnce([{ id: 'pay-resale', status: 'PENDING' }]) // payment lock
      .mockResolvedValueOnce([lockedRow]); // listing lock
    mockTx.resaleListing.findUnique.mockResolvedValue({
      ...lockedRow,
      status: ResaleStatus.SOLD,
      originalTicket: oldTicket,
      newTicket: { ticketCode: 'TKT-CONFIRMED' },
    });

    const result = await service.confirmResalePayment('pi_resale', 'listing-1', 'buyer-1');

    // The transfer path generates its own 36-char code and returns it.
    expect(result.newTicketCode).toMatch(/^TKT-[0-9A-F]{32}$/);
    expect(mockTx.ticket.create).toHaveBeenCalledTimes(1);
  });

  it('an already-completed confirm is idempotent even for a stale payment row', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'pay-resale',
      userId: 'buyer-1',
      status: 'COMPLETED',
    });
    mockPrisma.resaleListing = {
      findUnique: jest.fn().mockResolvedValue({
        ...lockedRow,
        status: ResaleStatus.SOLD,
        originalTicket: oldTicket,
      }),
    };

    const result = await service.confirmResalePayment('pi_resale', 'listing-1', 'buyer-1');
    expect(result.status).toBe(ResaleStatus.SOLD);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('a lost payment lock with a non-terminal state is a conflict, not a double transfer', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'pay-resale',
      resale_listing_id: 'listing-1',
      userId: 'buyer-1',
      status: 'PENDING',
      amount: 60,
      currency: 'USD',
    });
    (service as any).stripeClient = {
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          status: 'succeeded',
          amount_received: 6000,
          currency: 'usd',
        }),
      },
    };
    mockTx.$queryRaw.mockResolvedValueOnce([]); // another caller owns the payment
    mockTx.payment.findUnique.mockResolvedValue({ id: 'pay-resale', status: 'FAILED' });

    await expect(
      service.confirmResalePayment('pi_resale', 'listing-1', 'buyer-1'),
    ).rejects.toThrow(ConflictException);
    expect(mockTx.ticket.create).not.toHaveBeenCalled();
  });
});
