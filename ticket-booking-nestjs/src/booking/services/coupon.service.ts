import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReservationStatus, DiscountType } from '../entities/enums';
import { CreateCouponDto, ApplyCouponDto } from '../dto';
import { CouponResponseDto } from '../dto/response/coupon-response.dto';
import { ApplyCouponResponseDto } from '../dto/response/apply-coupon-response.dto';
import { PrismaService } from '../../prisma/prisma.service';

function isCouponValid(coupon: any): boolean {
  if (!coupon.active) return false;
  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) return false;
  if (coupon.validUntil && now > new Date(coupon.validUntil)) return false;
  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) return false;
  return true;
}

function calculateDiscount(coupon: any, cartTotal: number): number {
  let discount: number;
  if (coupon.discountType === DiscountType.PERCENTAGE) {
    discount = (cartTotal * Number(coupon.discountValue)) / 100;
    if (coupon.maxDiscountAmount) discount = Math.min(discount, Number(coupon.maxDiscountAmount));
  } else {
    discount = Math.min(Number(coupon.discountValue), cartTotal);
  }
  return Math.round(discount * 100) / 100;
}

@Injectable()
export class CouponService {
  constructor(private prisma: PrismaService) {}

  async createCoupon(dto: CreateCouponDto, admin: any): Promise<CouponResponseDto> {
    const code = dto.code.toUpperCase();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Coupon code already exists');

    if (dto.discountType === DiscountType.PERCENTAGE && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const saved = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        currency: dto.currency || 'USD',
        maxUses: dto.maxUses,
        maxUsesPerUser: dto.maxUsesPerUser || 1,
        minPurchaseAmount: dto.minPurchaseAmount,
        maxDiscountAmount: dto.maxDiscountAmount,
        eventId: dto.eventId,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        active: true,
        createdById: admin.id,
      },
    });
    return this.toResponse(saved);
  }

  async updateCoupon(couponId: string, dto: CreateCouponDto, admin: any): Promise<CouponResponseDto> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const data: any = {};
    if (dto.code) data.code = dto.code.toUpperCase();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType) data.discountType = dto.discountType;
    if (dto.discountValue) data.discountValue = dto.discountValue;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.maxUsesPerUser !== undefined) data.maxUsesPerUser = dto.maxUsesPerUser;
    if (dto.minPurchaseAmount !== undefined) data.minPurchaseAmount = dto.minPurchaseAmount;
    if (dto.maxDiscountAmount !== undefined) data.maxDiscountAmount = dto.maxDiscountAmount;
    if (dto.validFrom !== undefined) data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;

    const saved = await this.prisma.coupon.update({ where: { id: couponId }, data });
    return this.toResponse(saved);
  }

  async deactivateCoupon(couponId: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.update({ where: { id: couponId }, data: { active: false } });
  }

  async activateCoupon(couponId: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.update({ where: { id: couponId }, data: { active: true } });
  }

  async listCoupons(
    page = 0,
    size = 20,
  ): Promise<{ content: CouponResponseDto[]; totalElements: number; totalPages: number }> {
    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        include: { event: true },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.coupon.count(),
    ]);
    return {
      content: coupons.map((c) => this.toResponse(c)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getCoupon(couponId: string): Promise<CouponResponseDto> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { event: true },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.toResponse(coupon);
  }

  async deleteCoupon(couponId: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.currentUses > 0) {
      throw new BadRequestException('Cannot delete coupon that has been used');
    }
    await this.prisma.coupon.delete({ where: { id: couponId } });
  }

  async validateCoupon(
    code: string,
    reservationId: string,
    userId: string,
  ): Promise<ApplyCouponResponseDto> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (!isCouponValid(coupon)) throw new BadRequestException('Coupon is not valid');

    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId) throw new BadRequestException('Not authorized');
    if (coupon.eventId && coupon.eventId !== reservation.eventId) {
      throw new BadRequestException('Coupon is not valid for this event');
    }

    // Check min purchase
    if (coupon.minPurchaseAmount && Number(reservation.totalAmount) < Number(coupon.minPurchaseAmount)) {
      throw new BadRequestException(
        `Minimum purchase amount is ${coupon.minPurchaseAmount}`,
      );
    }

    // Check per-user limit using DB count (confirmed reservations with this coupon by this user)
    const userUsageCount = await this.prisma.reservation.count({
      where: { userId, couponId: coupon.id },
    });
    if (coupon.maxUsesPerUser && userUsageCount >= coupon.maxUsesPerUser) {
      throw new BadRequestException('You have reached the usage limit for this coupon');
    }

    const discount = calculateDiscount(coupon, Number(reservation.totalAmount));
    return {
      couponCode: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount: discount,
      originalAmount: Number(reservation.totalAmount),
      finalAmount: Number(reservation.totalAmount) - discount,
      currency: reservation.currency || 'USD',
      message: 'Coupon is valid',
    };
  }

  async applyCoupon(
    code: string,
    reservationId: string,
    userId: string,
  ): Promise<ApplyCouponResponseDto> {
    // Use a transaction to atomically validate + apply coupon
    return this.prisma.$transaction(async (tx) => {
      const [coupon] = await tx.$queryRaw<any[]>`
        SELECT * FROM coupons WHERE code = ${code.toUpperCase()} FOR UPDATE
      `;
      if (!coupon) throw new NotFoundException('Coupon not found');

      // Map raw column names to camelCase for helper functions
      const couponMapped = {
        ...coupon,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        maxUses: coupon.max_uses,
        currentUses: coupon.current_uses,
        maxUsesPerUser: coupon.max_uses_per_user,
        minPurchaseAmount: coupon.min_purchase_amount,
        maxDiscountAmount: coupon.max_discount_amount,
        validFrom: coupon.valid_from,
        validUntil: coupon.valid_until,
      };

      if (!isCouponValid(couponMapped)) throw new BadRequestException('Coupon is not valid');

      const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (reservation.userId !== userId) throw new BadRequestException('Not authorized');

      if (reservation.status !== ReservationStatus.PENDING) {
        throw new BadRequestException('Only PENDING reservations can have coupons applied');
      }
      if (coupon.event_id && coupon.event_id !== reservation.eventId) {
        throw new BadRequestException('Coupon is not valid for this event');
      }
      if (reservation.couponId) {
        throw new BadRequestException('A coupon is already applied to this reservation');
      }

      // Check min purchase
      if (couponMapped.minPurchaseAmount && Number(reservation.totalAmount) < Number(couponMapped.minPurchaseAmount)) {
        throw new BadRequestException(`Minimum purchase amount is ${couponMapped.minPurchaseAmount}`);
      }

      // Atomic per-user limit check via DB
      const userUsageCount = await tx.reservation.count({
        where: {
          userId,
          couponId: coupon.id,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
      });
      if (couponMapped.maxUsesPerUser && userUsageCount >= couponMapped.maxUsesPerUser) {
        throw new BadRequestException('You have reached the usage limit for this coupon');
      }

      // Check global usage
      if (couponMapped.maxUses && couponMapped.currentUses >= couponMapped.maxUses) {
        throw new BadRequestException('Coupon has reached its maximum uses');
      }

      const discount = calculateDiscount(couponMapped, Number(reservation.totalAmount));

      // Apply coupon
      await tx.reservation.update({
        where: { id: reservationId },
        data: { couponId: coupon.id, discountAmount: discount },
      });

      // Atomic increment coupon usage
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { currentUses: { increment: 1 } },
      });

      return {
        couponCode: coupon.code,
        description: coupon.description,
        discountType: couponMapped.discountType,
        discountValue: Number(couponMapped.discountValue),
        discountAmount: discount,
        originalAmount: Number(reservation.totalAmount),
        finalAmount: Number(reservation.totalAmount) - discount,
        currency: reservation.currency,
        message: 'Coupon applied successfully',
      };
    }, { isolationLevel: 'Serializable' });
  }

  async removeCoupon(reservationId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [reservation] = await tx.$queryRaw<any[]>`
        SELECT * FROM reservations WHERE id = ${reservationId}::uuid FOR UPDATE
      `;
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (reservation.user_id !== userId) throw new BadRequestException('Not authorized');
      if (reservation.status !== ReservationStatus.PENDING) {
        throw new BadRequestException('Only PENDING reservations can have coupons removed');
      }

      if (reservation.coupon_id) {
        const [coupon] = await tx.$queryRaw<any[]>`
          SELECT * FROM coupons WHERE id = ${reservation.coupon_id}::uuid FOR UPDATE
        `;
        if (coupon && coupon.current_uses > 0) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { currentUses: { decrement: 1 } },
          });
        }
      }

      await tx.reservation.update({
        where: { id: reservationId },
        data: { couponId: null, discountAmount: 0 },
      });
    }, { isolationLevel: 'Serializable' });
  }

  private toResponse(c: any): CouponResponseDto {
    return {
      id: c.id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      currency: c.currency,
      maxUses: c.maxUses,
      currentUses: c.currentUses,
      maxUsesPerUser: c.maxUsesPerUser,
      minPurchaseAmount: c.minPurchaseAmount ? Number(c.minPurchaseAmount) : null,
      maxDiscountAmount: c.maxDiscountAmount ? Number(c.maxDiscountAmount) : null,
      eventId: c.eventId,
      eventName: c.event?.name ?? null,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      active: c.active,
      createdAt: c.createdAt,
    };
  }
}
