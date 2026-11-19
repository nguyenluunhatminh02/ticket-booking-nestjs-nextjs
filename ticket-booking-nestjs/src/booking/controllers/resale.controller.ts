import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { ResaleService } from '../services/resale.service';
import { ResaleListingDto } from '../dto';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('resale')
export class ResaleController {
  constructor(private readonly resaleService: ResaleService) {}

  @Public()
  @Get('marketplace')
  async getMarketplace(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.resaleService.getAllMarketplace(page, size);
  }

  @Public()
  @Get('event/:eventId')
  async getMarketplaceByEvent(
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.resaleService.getMarketplaceByEvent(eventId, page, size);
  }

  @Get('my-listings')
  async getMyListings(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.resaleService.getMyListings(user.id, page, size);
  }

  @Public()
  @Get(':listingId')
  async getListingDetails(@Param('listingId') listingId: string) {
    return this.resaleService.getListingDetails(listingId);
  }

  @Post('list')
  async listForResale(@Body() dto: ResaleListingDto, @CurrentUser() user: User) {
    return this.resaleService.listForResale(dto, user);
  }

  @Post(':listingId/lock')
  async lockForPurchase(
    @Param('listingId') listingId: string,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.lockForPurchase(listingId, user);
  }

  @Post(':listingId/purchase')
  async completePurchase(
    @Param('listingId') listingId: string,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.completePurchase(listingId, user);
  }

  @Post(':listingId/cancel')
  async cancelListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: User,
  ) {
    return this.resaleService.cancelListing(listingId, user);
  }
}
