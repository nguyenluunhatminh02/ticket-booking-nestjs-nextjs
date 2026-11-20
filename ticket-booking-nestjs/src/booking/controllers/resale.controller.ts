import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Public, CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';
import { ResaleService } from '../services/resale.service';
import { ResaleListingDto } from '../dto';
import { PaymentProvider } from '../entities/enums';

@Controller('resale')
export class ResaleController {
  constructor(private readonly resaleService: ResaleService) {}

  @Public()
  @Get('marketplace')
  async getMarketplace(@Query('eventId') eventId?: string) {
    return this.resaleService.getMarketplace(eventId);
  }

  @Get('event/:eventId')
  async getMarketplaceByEvent(@Param('eventId') eventId: string) {
    return this.resaleService.getMarketplace(eventId);
  }

  @Post('list')
  async createListing(
    @Body() dto: ResaleListingDto,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.createListing(dto, user);
  }

  @Get('my-listings')
  async getMyListings(@CurrentUser() user: User) {
    return this.resaleService.getUserListings(user.id);
  }

  @Post(':listingId/lock')
  async lockListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.lockListing(listingId, user);
  }

  @Post(':listingId/payment')
  async initiatePayment(
    @Param('listingId') listingId: string,
    @Body('provider') provider: PaymentProvider,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.initiateResalePayment(listingId, user, provider || PaymentProvider.STRIPE);
  }

  @Post(':listingId/confirm-payment')
  async confirmPayment(
    @Param('listingId') listingId: string,
    @Body('paymentIntentId') paymentIntentId: string,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.confirmResalePayment(paymentIntentId, listingId, user.id);
  }

  @Get(':listingId')
  async getListingDetails(@Param('listingId') listingId: string) {
    return this.resaleService.getListingDetails(listingId);
  }

  @Post(':listingId/cancel')
  async cancelListingPost(
    @Param('listingId') listingId: string,
    @CurrentUser() user: User,
  ) {
    await this.resaleService.cancelListing(listingId, user);
    return { message: 'Listing cancelled' };
  }

  @Delete(':listingId')
  async cancelListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: User,
  ) {
    await this.resaleService.cancelListing(listingId, user);
    return { message: 'Listing cancelled' };
  }
}
