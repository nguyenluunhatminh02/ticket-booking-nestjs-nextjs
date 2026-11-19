import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { CouponService } from '../services/coupon.service';
import { CreateCouponDto, ApplyCouponDto } from '../dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Roles('ROLE_ADMIN')
  @Get()
  async listCoupons(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.couponService.listCoupons(page, size);
  }

  @Roles('ROLE_ADMIN')
  @Post()
  async createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: User) {
    return this.couponService.createCoupon(dto, user);
  }

  @Post('validate')
  async validateCoupon(@Body() dto: ApplyCouponDto, @CurrentUser() user: User) {
    return this.couponService.validateCoupon(dto.couponCode, dto.reservationId, user.id);
  }

  @Post('apply')
  async applyCoupon(@Body() dto: ApplyCouponDto, @CurrentUser() user: User) {
    return this.couponService.applyCoupon(dto.couponCode, dto.reservationId, user.id);
  }

  @Delete('remove/:reservationId')
  async removeCoupon(@Param('reservationId') reservationId: string, @CurrentUser() user: User) {
    return this.couponService.removeCoupon(reservationId, user.id);
  }

  @Roles('ROLE_ADMIN')
  @Post(':couponId/activate')
  async activateCoupon(@Param('couponId') couponId: string) {
    return this.couponService.activateCoupon(couponId);
  }

  @Roles('ROLE_ADMIN')
  @Post(':couponId/deactivate')
  async deactivateCoupon(@Param('couponId') couponId: string) {
    return this.couponService.deactivateCoupon(couponId);
  }

  @Roles('ROLE_ADMIN')
  @Delete(':couponId')
  async deleteCoupon(@Param('couponId') couponId: string) {
    return this.couponService.deleteCoupon(couponId);
  }
}
