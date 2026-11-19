import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationStatus, DiscountType } from '../entities/enums';

describe('CouponService', () => {
  let service: CouponService;
  let prisma: any;

  const mockTx = {
    $queryRaw: jest.fn(),
    reservation: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
    coupon: { findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    prisma = {
      coupon: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      reservation: { findUnique: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(mockTx)),
    };

    const module = await Test.createTestingModule({
      providers: [
        CouponService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CouponService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateCoupon', () => {
    const coupon = {
      id: 'c-1',
      code: 'SAVE10',
      active: true,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      maxUses: 100,
      currentUses: 5,
      maxUsesPerUser: 2,
      eventId: null,
      validFrom: null,
      validUntil: null,
      minPurchaseAmount: null,
      maxDiscountAmount: null,
    };
    const reservation = {
      id: 'res-1',
      userId: 'user-1',
      eventId: 'ev-1',
      totalAmount: 100,
      currency: 'USD',
    };

    it('should throw for non-existent coupon', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.validateCoupon('BAD', 'res-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw for inactive coupon', async () => {
      prisma.coupon.findUnique.mockResolvedValue({ ...coupon, active: false });
      prisma.reservation.findUnique.mockResolvedValue(reservation);
      await expect(service.validateCoupon('SAVE10', 'res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject event-scoped coupon for wrong event', async () => {
      prisma.coupon.findUnique.mockResolvedValue({ ...coupon, eventId: 'ev-other' });
      prisma.reservation.findUnique.mockResolvedValue(reservation);
      await expect(service.validateCoupon('SAVE10', 'res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should calculate percentage discount correctly', async () => {
      prisma.coupon.findUnique.mockResolvedValue(coupon);
      prisma.reservation.findUnique.mockResolvedValue(reservation);
      prisma.reservation.count.mockResolvedValue(0);
      const result = await service.validateCoupon('SAVE10', 'res-1', 'user-1');
      expect(result.discountAmount).toBe(10);
      expect(result.finalAmount).toBe(90);
    });
  });

  describe('removeCoupon', () => {
    it('should decrement coupon usage within transaction', async () => {
      mockTx.$queryRaw
        .mockResolvedValueOnce([{ user_id: 'user-1', status: ReservationStatus.PENDING, coupon_id: 'c-1' }])
        .mockResolvedValueOnce([{ id: 'c-1', current_uses: 3 }]);
      await service.removeCoupon('res-1', 'user-1');
      expect(mockTx.coupon.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { currentUses: { decrement: 1 } },
      }));
      expect(mockTx.reservation.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { couponId: null, discountAmount: 0 },
      }));
    });

    it('should reject non-PENDING reservation', async () => {
      mockTx.$queryRaw.mockResolvedValueOnce([{ user_id: 'user-1', status: ReservationStatus.CONFIRMED }]);
      await expect(service.removeCoupon('res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createCoupon', () => {
    it('should reject duplicate coupon code', async () => {
      prisma.coupon.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.createCoupon({ code: 'DUP', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5 } as any, { id: 'admin' })).rejects.toThrow(BadRequestException);
    });

    it('should reject percentage > 100', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.createCoupon({ code: 'NEW', discountType: DiscountType.PERCENTAGE, discountValue: 150 } as any, { id: 'admin' })).rejects.toThrow(BadRequestException);
    });
  });
});
