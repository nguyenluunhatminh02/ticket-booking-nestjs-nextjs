import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { MlModule } from '../ml/ml.module';

import {
  VenueService,
  OrganizerService,
  EventService,
  ReservationService,
  TicketService,
  PaymentService,
  CheckInService,
  QueueService,
  CouponService,
  CommentService,
  ResaleService,
  SmartSeatService,
  DashboardService,
  EventMediaService,
  LivestreamService,
  SeatLockService,
} from './services';

import { SeatGateway } from './gateways/seat.gateway';

import {
  EventController,
  BookingController,
  TicketController,
  PaymentController,
  CheckInController,
  QueueController,
  CouponController,
  CommentController,
  VenueController,
  OrganizerController,
  ResaleController,
  SmartSeatController,
  EventMediaController,
  LivestreamController,
  AdminController,
  AdminVideoController,
} from './controllers';

const services = [
  VenueService,
  OrganizerService,
  EventService,
  ReservationService,
  TicketService,
  PaymentService,
  CheckInService,
  QueueService,
  CouponService,
  CommentService,
  ResaleService,
  SmartSeatService,
  DashboardService,
  EventMediaService,
  LivestreamService,
  SeatLockService,
];

const controllers = [
  EventController,
  BookingController,
  TicketController,
  PaymentController,
  CheckInController,
  QueueController,
  CouponController,
  CommentController,
  VenueController,
  OrganizerController,
  ResaleController,
  SmartSeatController,
  EventMediaController,
  LivestreamController,
  AdminController,
  AdminVideoController,
];

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    MlModule,
  ],
  controllers,
  providers: [...services, SeatGateway],
  exports: [...services],
})
export class BookingModule {}
