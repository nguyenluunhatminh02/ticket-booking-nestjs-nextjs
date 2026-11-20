import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, PaymentProvider, ReservationStatus } from '../entities/enums';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockTx: any;
  let reservationService: any;
  let ticketService: any;
  let configService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      reservation: { findUnique: jest.fn() },
      ticket: { findMany: jest.fn(), updateMany: jest.fn() },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    mockPrisma = {
      payment: mockTx.payment,
      reservation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'res-1', items: [] }),
      },
      resaleListing: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((fn: any) => fn(mockTx)),
    };

    reservationService = {
      getReservationEntity: jest.fn(),
      confirmReservation: jest.fn(),
      releaseReservation: jest.fn(),
      extendExpiry: jest.fn(),
    };

    ticketService = {
      issueTicketsForReservation: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        return null;
      }),
    };

    service = new PaymentService(
      mockPrisma as any,
      reservationService as any,
      ticketService as any,
      configService as any,
    );
  });

  describe('initiatePayment', () => {
    const dto = { reservationId: 'res-1', provider: PaymentProvider.STRIPE };
    const user = { id: 'user-1' };
    const reservation = {
      id: 'res-1',
      userId: 'user-1',
      status: ReservationStatus.PENDING,
      totalAmount: 100,
      discountAmount: 0,
      currency: 'USD',
      expiresAt: new Date(Date.now() + 600000),
    };

    it('should reject unauthorized user', async () => {
      reservationService.getReservationEntity.mockResolvedValue({ ...reservation, userId: 'other' });
      await expect(service.initiatePayment(dto as any, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject non-PENDING reservation', async () => {
      reservationService.getReservationEntity.mockResolvedValue({ ...reservation, status: ReservationStatus.CONFIRMED });
      await expect(service.initiatePayment(dto as any, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject expired reservation', async () => {
      reservationService.getReservationEntity.mockResolvedValue({ ...reservation, expiresAt: new Date(Date.now() - 1000) });
      await expect(service.initiatePayment(dto as any, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject zero or negative amount', async () => {
      reservationService.getReservationEntity.mockResolvedValue({ ...reservation, totalAmount: 0 });
      await expect(service.initiatePayment(dto as any, user)).rejects.toThrow(BadRequestException);
    });

    it('should reject unsupported provider', async () => {
      reservationService.getReservationEntity.mockResolvedValue(reservation);
      await expect(service.initiatePayment({ ...dto, provider: 'UNKNOWN' as any }, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmStripePayment', () => {
    const payment = {
      id: 'pay-1',
      reservationId: 'res-1',
      userId: 'user-1',
      status: PaymentStatus.PENDING,
      amount: 100,
      currency: 'USD',
      providerPaymentId: 'pi_123',
    };

    it('should throw NotFoundException for unknown payment', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      await expect(service.confirmStripePayment('pi_123', 'res-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject unauthorized user', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({ ...payment, userId: 'other' });
      await expect(service.confirmStripePayment('pi_123', 'res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should return idempotently for already-completed payment', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({ ...payment, status: PaymentStatus.COMPLETED });
      const result = await service.confirmStripePayment('pi_123', 'res-1', 'user-1');
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should reject non-PENDING payment', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({ ...payment, status: PaymentStatus.FAILED });
      await expect(service.confirmStripePayment('pi_123', 'res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundPayment', () => {
    const payment = {
      id: 'pay-1',
      reservationId: 'res-1',
      userId: 'user-1',
      status: PaymentStatus.COMPLETED,
      amount: 100,
      currency: 'USD',
      provider: PaymentProvider.STRIPE,
      providerPaymentId: 'pi_123',
    };

    it('should throw NotFoundException when no completed payment', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      await expect(service.refundPayment('res-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should reject unauthorized user', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({ id: 'res-1', items: [] });
      mockPrisma.resaleListing = { findFirst: jest.fn().mockResolvedValue(null) };
      mockPrisma.payment.findFirst.mockResolvedValue({ ...payment, userId: 'other' });
      await expect(service.refundPayment('res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should return idempotently for already-refunded payment', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({ id: 'res-1', items: [] });
      mockPrisma.resaleListing = { findFirst: jest.fn().mockResolvedValue(null) };
      mockPrisma.payment.findFirst.mockResolvedValue({ ...payment, status: PaymentStatus.REFUNDED });
      const result = await service.refundPayment('res-1', 'user-1');
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('handleStripeWebhook', () => {
    it('should reject invalid webhook signature', async () => {
      (service as any).stripeClient = {
        webhooks: { constructEvent: jest.fn().mockImplementation(() => { throw new Error('sig'); }) },
      };
      await expect(service.handleStripeWebhook('{}', 'bad-sig')).rejects.toThrow(BadRequestException);
    });

    it('should ignore non-payment_intent.succeeded events', async () => {
      (service as any).stripeClient = {
        webhooks: { constructEvent: jest.fn().mockReturnValue({ type: 'charge.succeeded', data: { object: {} } }) },
      };
      await expect(service.handleStripeWebhook('{}', 'sig')).resolves.toBeUndefined();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
