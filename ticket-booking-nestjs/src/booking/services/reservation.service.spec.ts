import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationStatus, EventStatus, SeatStatus } from '../entities/enums';

const mockTx = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  queueEntry: { findFirst: jest.fn() },
  reservation: { aggregate: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  reservationItem: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
  seat: { updateMany: jest.fn() },
  ticketTier: { update: jest.fn() },
  ticket: { findMany: jest.fn(), updateMany: jest.fn() },
  event: { findUnique: jest.fn(), update: jest.fn() },
  coupon: { update: jest.fn() },
  resaleListing: { updateMany: jest.fn() },
};

const mockPrisma = {
  reservation: { findMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockTx)),
};

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { ReservationService } from './reservation.service';
import { SeatLockService } from './seat-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReservationService', () => {
  let service: ReservationService;
  let seatLockService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    seatLockService = {
      getLockedSeats: jest.fn().mockResolvedValue({}),
      unlockSeat: jest.fn().mockResolvedValue(true),
      releaseAllUserLocks: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SeatLockService, useValue: seatLockService },
      ],
    }).compile();

    service = module.get(ReservationService);
  });

  describe('confirmReservation', () => {
    it('should skip already-confirmed reservation', async () => {
      mockTx.reservation.findUnique.mockResolvedValue({ status: ReservationStatus.CONFIRMED });
      await service.confirmReservation('res-1', mockTx);
      expect(mockTx.reservation.update).not.toHaveBeenCalled();
    });

    it('should reject non-PENDING reservation', async () => {
      mockTx.reservation.findUnique.mockResolvedValue({ status: ReservationStatus.CANCELLED, items: [] });
      await expect(service.confirmReservation('res-1', mockTx)).rejects.toThrow(BadRequestException);
    });

    it('should confirm PENDING reservation and update seats', async () => {
      mockTx.reservation.findUnique.mockResolvedValue({
        status: ReservationStatus.PENDING,
        eventId: 'ev-1',
        items: [{ seatId: 'seat-1' }],
      });
      mockTx.event.findUnique.mockResolvedValue({ availableTickets: 5 });
      await service.confirmReservation('res-1', mockTx);
      expect(mockTx.reservation.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: ReservationStatus.CONFIRMED }),
      }));
      expect(mockTx.seat.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: SeatStatus.SOLD },
      }));
    });
  });

  describe('releaseReservation', () => {
    const reservation = { id: 'res-1', eventId: 'ev-1', status: ReservationStatus.PENDING };

    it('should skip already-cancelled reservation', async () => {
      mockTx.$queryRaw.mockResolvedValue([{ status: ReservationStatus.CANCELLED }]);
      await service.releaseReservation(reservation, mockTx);
      expect(mockTx.reservation.update).not.toHaveBeenCalled();
    });

    it('should cancel tickets and resale listings on release', async () => {
      mockTx.$queryRaw.mockResolvedValue([{ status: ReservationStatus.CONFIRMED, ticket_count: 2 }]);
      mockTx.reservationItem.findMany.mockResolvedValue([{ seatId: 's1', tierId: 't1' }]);
      mockTx.ticket.findMany.mockResolvedValue([{ id: 'tk-1' }]);
      mockTx.event.findUnique.mockResolvedValue({ status: EventStatus.ON_SALE, availableTickets: 10 });
      await service.releaseReservation(reservation, mockTx);
      expect(mockTx.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }));
      expect(mockTx.resaleListing.updateMany).toHaveBeenCalled();
    });
  });

  describe('reserveTickets - ticket limit', () => {
    it('should use aggregate sum of ticketCount for per-user limit', async () => {
      const dto = { eventId: 'ev-1', tierId: 't-1', quantity: 2 };
      const user = { id: 'user-1' };

      mockTx.$queryRaw
        .mockResolvedValueOnce([{ status: EventStatus.ON_SALE, queue_enabled: false, max_tickets_per_user: 3 }])
        .mockResolvedValueOnce([{ available_quantity: 10, price: 50, currency: 'USD' }])
        .mockResolvedValueOnce([{ id: 'seat-1' }, { id: 'seat-2' }]);
      mockTx.reservation.aggregate.mockResolvedValue({ _sum: { ticketCount: 2 } });
      mockTx.reservation.create.mockResolvedValue({ id: 'res-1', status: ReservationStatus.PENDING });
      mockTx.reservationItem.create.mockResolvedValue({ id: 'item-1' });
      mockTx.event.findUnique.mockResolvedValue({ availableTickets: 8, status: EventStatus.ON_SALE });

      await expect(service.reserveTickets(dto as any, user as any)).rejects.toThrow(BadRequestException);
    });
  });
});
