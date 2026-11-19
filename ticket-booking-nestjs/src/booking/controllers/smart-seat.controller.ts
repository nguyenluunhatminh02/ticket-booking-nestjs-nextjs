import {
  Controller,
  Get,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { SmartSeatService } from '../services/smart-seat.service';

@Controller('smart-seats')
export class SmartSeatController {
  constructor(private readonly smartSeatService: SmartSeatService) {}

  @Public()
  @Get('suggest/:eventId')
  async suggestSeats(
    @Param('eventId') eventId: string,
    @Query('tierId') tierId: string,
    @Query('quantity', new DefaultValuePipe(1), ParseIntPipe) quantity: number,
  ) {
    return this.smartSeatService.findBestSeats(eventId, tierId, quantity);
  }

  @Public()
  @Get('pricing/:tierId')
  async getDynamicPrice(@Param('tierId') tierId: string) {
    // tierId is enough - we'll find the eventId from the tier
    return this.smartSeatService.getDynamicPriceByTierId(tierId);
  }

  @Public()
  @Get('pricing/event/:eventId')
  async getEventPricing(@Param('eventId') eventId: string) {
    return this.smartSeatService.getAllDynamicPrices(eventId);
  }
}
