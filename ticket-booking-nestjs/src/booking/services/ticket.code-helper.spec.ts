import { TicketService } from './ticket.service';
import { ResaleService } from './resale.service';
import { TicketStatus, ResaleStatus } from '../entities/enums';

/**
 * Ticket-code helper coverage (length + uniqueness + collision retry).
 *
 * Ticket codes are 128-bit UUIDv4 values rendered as `TKT-` plus 32 uppercase
 * hex chars. Issuing is idempotent per reservation, and a Prisma P2002 on the
 * ticket code is retried up to 3 times. All DB access is mocked; no Postgres
 * or live payment provider is needed.
 */
describe('ticket code helpers', () => {
  const expectedCodePattern = /^TKT-[0-9A-F]{32}$/;

  describe('TicketService.issueTicketsForReservation', () => {
    let service: TicketService;
    let tx: any;

    const reservation: any = {
      id: 'res-codes',
      eventId: 'event-1',
      userId: 'buyer-1',
      currency: 'USD',
      items: [
        { tierId: 'tier-1', seatId: 'seat-1', priceAtBooking: 50 },
        { tierId: 'tier-1', seatId: 'seat-2', priceAtBooking: 50 },
      ],
    };

    beforeEach(() => {
      jest.clearAllMocks();
      tx = {
        ticket: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockImplementation(({ data }: any) =>
            Promise.resolve({ id: `ticket-${tx.ticket.create.mock.calls.length}`, ...data }),
          ),
        },
      };
      service = new TicketService(tx as any);
    });

    it('generates 36-char 128-bit codes that are unique within a reservation', async () => {
      const tickets = await service.issueTicketsForReservation(reservation, tx);

      expect(tickets).toHaveLength(2);
      for (const ticket of tickets) {
        expect(ticket.ticketCode).toMatch(expectedCodePattern);
        expect(ticket.ticketCode).toHaveLength(36); // 'TKT-' (4) + 32 hex
        expect(JSON.parse(ticket.qrCodeData)).toEqual(
          expect.objectContaining({ ticketCode: ticket.ticketCode, eventId: 'event-1' }),
        );
      }
      expect(new Set(tickets.map((t) => t.ticketCode)).size).toBe(2);

      // Most importantly: the DB is asked to insert two distinct codes.
      const insertedCodes = tx.ticket.create.mock.calls.map(([args]: any[]) => args.data.ticketCode);
      expect(new Set(insertedCodes).size).toBe(2);
    });

    it('is idempotent: existing tickets are returned instead of reissued', async () => {
      const existing = [{ id: 'ticket-existing', ticketCode: 'TKT-EXISTING' }];
      tx.ticket.findMany.mockResolvedValue(existing);

      const result = await service.issueTicketsForReservation(reservation, tx);
      expect(result).toBe(existing as any);
      expect(tx.ticket.create).not.toHaveBeenCalled();
    });

    it('retries only a ticket-code collision (P2002), up to 3 attempts', async () => {
      const collision = { code: 'P2002', meta: { target: ['ticketCode'] } };
      tx.ticket.create
        .mockRejectedValueOnce(collision)
        .mockRejectedValueOnce(collision)
        .mockResolvedValueOnce({ id: 'ticket-3', ticketCode: 'TKT-OK' });

      const tickets = await service.issueTicketsForReservation(
        { ...reservation, items: [reservation.items[0]] },
        tx,
      );
      expect(tx.ticket.create).toHaveBeenCalledTimes(3);
      expect(tickets[0].id).toBe('ticket-3');
    });

    it('stops after 3 collisions instead of looping forever', async () => {
      tx.ticket.create.mockRejectedValue({ code: 'P2002', meta: { target: ['ticketCode'] } });
      await expect(
        service.issueTicketsForReservation({ ...reservation, items: [reservation.items[0]] }, tx),
      ).rejects.toMatchObject({ code: 'P2002' });
      expect(tx.ticket.create).toHaveBeenCalledTimes(3);
    });

    it('does not retry a non-collision error', async () => {
      const failure = new Error('connection lost');
      tx.ticket.create.mockRejectedValueOnce(failure);
      await expect(
        service.issueTicketsForReservation({ ...reservation, items: [reservation.items[0]] }, tx),
      ).rejects.toBe(failure);
      expect(tx.ticket.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('ResaleService.completeResaleTransfer ticket code', () => {
    let service: ResaleService;
    let tx: any;

    const lockedListing = {
      id: 'listing-codes',
      status: ResaleStatus.LOCKED,
      buyer_id: 'buyer-1',
      ticket_id: 'old-ticket',
      lock_expires_at: new Date(Date.now() + 600_000),
      asking_price: 60,
      currency: 'USD',
    };
    const oldTicket = {
      id: 'old-ticket',
      reservationId: 'res-1',
      eventId: 'event-1',
      tierId: 'tier-1',
      seatId: null,
      status: TicketStatus.VALID,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      tx = {
        $queryRaw: jest.fn().mockResolvedValue([lockedListing]),
        ticket: {
          findUnique: jest.fn().mockResolvedValue(oldTicket),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'new-ticket', ...data }),
          ),
        },
        resaleListing: {
          update: jest.fn().mockResolvedValue({
            ...lockedListing,
            status: ResaleStatus.SOLD,
            originalTicket: oldTicket,
          }),
        },
      };
      service = new ResaleService(
        { payment: { update: jest.fn() } } as any,
        { get: jest.fn().mockReturnValue(null) } as any,
      );
    });

    const payment = { id: 'pay-codes', resale_listing_id: 'listing-codes', userId: 'buyer-1' };

    it('issues a fresh full-length unique code and matches it in qrCodeData', async () => {
      const result = await service.completeResaleTransfer(payment, tx);

      expect(result.newTicketCode).toMatch(expectedCodePattern);
      expect(result.newTicketCode).toHaveLength(36);
      const inserted = tx.ticket.create.mock.calls[0][0].data;
      expect(inserted.ticketCode).toBe(result.newTicketCode);
      expect(JSON.parse(inserted.qrCodeData)).toEqual({
        ticketCode: result.newTicketCode,
        eventId: 'event-1',
      });
      expect(inserted.status).toBe(TicketStatus.VALID);
    });

    it('retries a ticket-code collision and succeeds with a different code', async () => {
      tx.ticket.create
        .mockRejectedValueOnce({ code: 'P2002', meta: { target: 'ticketCode' } })
        .mockImplementationOnce(({ data }: any) =>
          Promise.resolve({ id: 'new-ticket', ...data }),
        );

      const result = await service.completeResaleTransfer(payment, tx);
      expect(tx.ticket.create).toHaveBeenCalledTimes(2);
      const firstCode = tx.ticket.create.mock.calls[0][0].data.ticketCode;
      const retryCode = tx.ticket.create.mock.calls[1][0].data.ticketCode;
      expect(result.newTicketCode).toBe(retryCode);
      expect(retryCode).toMatch(expectedCodePattern);
      expect(retryCode).not.toBe(firstCode);
    });
  });
});
