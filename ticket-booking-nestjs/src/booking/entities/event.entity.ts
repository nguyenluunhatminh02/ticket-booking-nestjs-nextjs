import { EventCategory, EventStatus, EventMode } from './enums';

export class Event {
  id: string;
  venue?: any;
  venueId: string;
  createdBy?: any;
  createdById: string;
  name: string;
  description: string;
  artistName: string;
  category: EventCategory;
  eventDate: Date;
  doorsOpenAt: Date;
  status: EventStatus;
  coverImageUrl: string;
  totalTickets: number;
  availableTickets: number;
  onSaleAt: Date;
  presaleAt: Date;
  maxTicketsPerUser: number;
  queueEnabled: boolean;
  eventMode: EventMode;
  streamingUrl: string;
  muxPlaybackId: string;
  muxAssetId: string;
  organizer?: any;
  organizerId: string;
  endDate: Date;
  bannerUrl: string;
  ticketTiers?: any[];
  seats?: any[];
  schedules?: any[];
  media?: any[];
  createdAt: Date;
  updatedAt: Date;
}
