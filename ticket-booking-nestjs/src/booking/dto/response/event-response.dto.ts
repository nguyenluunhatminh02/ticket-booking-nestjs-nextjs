import { VenueResponseDto } from './venue-response.dto';
import { OrganizerResponseDto } from './organizer-response.dto';
import { TicketTierResponseDto } from './ticket-tier-response.dto';
import { EventScheduleResponseDto } from './event-schedule-response.dto';

export class EventResponseDto {
  id: string;
  name: string;
  description: string | null;
  artistName: string | null;
  category: string | null;
  status: string;
  eventMode: string | null;
  streamingUrl: string | null;
  muxPlaybackId: string | null;
  bannerUrl: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  doorsOpenAt: Date | null;
  coverImageUrl: string | null;
  totalTickets: number;
  availableTickets: number;
  onSaleAt: Date | null;
  presaleAt: Date | null;
  maxTicketsPerUser: number | null;
  queueEnabled: boolean | null;
  venue: VenueResponseDto | null;
  organizer: OrganizerResponseDto | null;
  ticketTiers: TicketTierResponseDto[];
  schedules: EventScheduleResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
