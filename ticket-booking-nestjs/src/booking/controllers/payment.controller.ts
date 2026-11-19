import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  RawBody,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PaymentService } from '../services/payment.service';
import { InitiatePaymentDto, ConfirmStripePaymentDto } from '../dto';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @Get('providers')
  async getProviders() {
    return this.paymentService.getAvailableProviders();
  }

  @Post('initiate')
  async initiatePayment(@Body() dto: InitiatePaymentDto, @CurrentUser() user: User) {
    return this.paymentService.initiatePayment(dto, user);
  }

  @Post('confirm-stripe')
  async confirmStripePayment(@Body() dto: ConfirmStripePaymentDto, @CurrentUser() user: User) {
    return this.paymentService.confirmStripePayment(dto.paymentIntentId, dto.reservationId, user.id);
  }

  @Get('status/:reservationId')
  async getPaymentStatus(
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentService.getPaymentStatus(reservationId, user.id);
  }

  @Post('refund/:reservationId')
  async refundPayment(
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentService.refundPayment(reservationId, user.id);
  }

  @Public()
  @Post('webhook/stripe')
  async stripeWebhook(@RawBody() rawBody: Buffer, @Headers('stripe-signature') sigHeader: string) {
    return this.paymentService.handleStripeWebhook(rawBody.toString(), sigHeader || '');
  }
}
