import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStatus, EventCategory, SeatStatus } from '../entities/enums';
import { CreateEventDto, CreateTicketTierDto } from '../dto';
import { EventResponseDto } from '../dto/response/event-response.dto';
import { VenueService } from './venue.service';
import { SeatResponseDto, SeatMapResponseDto } from '../dto/response/seat-response.dto';
import { TicketTierResponseDto } from '../dto/response/ticket-tier-response.dto';
import { EventScheduleResponseDto } from '../dto/response/event-schedule-response.dto';
import { User } from '../../auth/entities/user.entity';
import { OrganizerService } from './organizer.service';

function getEffectivePrice(tier: any): number {
  const now = new Date();
  if (tier.earlyBirdPrice && tier.earlyBirdEndDate && now < new Date(tier.earlyBirdEndDate)) return Number(tier.earlyBirdPrice);
  if (tier.lastMinutePrice && tier.lastMinuteStartDate && now >= new Date(tier.lastMinuteStartDate)) return Number(tier.lastMinutePrice);
  return Number(tier.price);
}

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private venueService: VenueService,
    private organizerService: OrganizerService,
  ) {}

  async listEvents(
    statuses?: string[],
    category?: EventCategory,
    city?: string,
    fromDate?: string,
    toDate?: string,
    page = 0,
    size = 20,
  ): Promise<{ content: EventResponseDto[]; totalElements: number; totalPages: number }> {
    const statusList = statuses?.length
      ? statuses
      : [EventStatus.ON_SALE, EventStatus.PRESALE];

    const where: any = {
      status: { in: statusList },
    };

    if (category) where.category = category;
    if (city) where.venue = { city: { equals: city, mode: 'insensitive' } };
    if (fromDate) where.eventDate = { ...(where.eventDate || {}), gte: new Date(fromDate) };
    if (toDate) where.eventDate = { ...(where.eventDate || {}), lte: new Date(toDate) };

    const include = {
      venue: true,
      organizer: true,
      ticketTiers: true,
      schedules: true,
    };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include,
        orderBy: { eventDate: 'asc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      content: events.map((e) => this.toResponse(e)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getEvent(eventId: string): Promise<EventResponseDto> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: true, organizer: true, ticketTiers: true, schedules: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.toResponse(event);
  }

  async searchEvents(
    q: string,
    page = 0,
    size = 20,
  ): Promise<{ content: EventResponseDto[]; totalElements: number; totalPages: number }> {
    const where = {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { artistName: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const include = {
      venue: true,
      organizer: true,
      ticketTiers: true,
      schedules: true,
    };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include,
        orderBy: { eventDate: 'asc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      content: events.map((e) => this.toResponse(e)),
      totalElements: total,
      totalPages: Math.ceil(total / size),
    };
  }

  async getSeatMap(eventId: string): Promise<SeatMapResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const seats = await this.prisma.seat.findMany({
      where: { eventId },
      include: { tier: true },
      orderBy: [{ section: 'asc' }, { rowName: 'asc' }, { seatNumber: 'asc' }],
    });

    const sections: Record<string, SeatResponseDto[]> = {};
    let available = 0;
    for (const s of seats) {
      const dto: SeatResponseDto = {
        id: s.id,
        section: s.section,
        rowName: s.rowName,
        seatNumber: s.seatNumber,
        status: s.status,
        price: Number(s.priceOverride ?? s.tier?.price ?? 0),
        currency: (s.tier?.currency as string) || 'USD',
        label: `${s.section}-${s.rowName}-${s.seatNumber}`,
        tierId: s.tierId,
        tierName: s.tier?.name ?? null,
      };
      if (!sections[s.section]) sections[s.section] = [];
      sections[s.section].push(dto);
      if (s.status === SeatStatus.AVAILABLE) available++;
    }

    return {
      eventId,
      eventName: event.name,
      sections,
      totalSeats: seats.length,
      availableSeats: available,
    };
  }

  async createEvent(dto: CreateEventDto, user: User): Promise<EventResponseDto> {
    const venue = await this.prisma.venue.findUnique({ where: { id: dto.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');

    const saved = await this.prisma.event.create({
      data: {
        name: dto.name,
        description: dto.description,
        artistName: dto.artistName,
        category: dto.category,
        eventDate: new Date(dto.eventDate),
        doorsOpenAt: dto.doorsOpenAt ? new Date(dto.doorsOpenAt) : undefined,
        coverImageUrl: dto.coverImageUrl,
        maxTicketsPerUser: dto.maxTicketsPerUser,
        queueEnabled: dto.queueEnabled ?? false,
        venueId: dto.venueId,
        createdById: user.id,
        status: EventStatus.DRAFT,
        totalTickets: 0,
        availableTickets: 0,
      },
    });

    return this.getEvent(saved.id);
  }

  private assertEventOwner(event: any, user?: User): void {
    if (!user) return;
    const userRoles: string[] = (user as any).roles?.map?.((r: any) => r.name || r) || [];
    if (event.createdById !== user.id && !userRoles.includes('ROLE_ADMIN')) {
      throw new BadRequestException('You are not authorized to manage this event');
    }
  }

  async addTicketTier(eventId: string, dto: CreateTicketTierDto, user?: User): Promise<EventResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    this.assertEventOwner(event, user);
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Can only add tiers to DRAFT events');
    }

    const tier = await this.prisma.ticketTier.create({
      data: {
        eventId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency || 'USD',
        totalQuantity: dto.totalQuantity,
        availableQuantity: dto.totalQuantity,
        maxPerUser: dto.maxPerUser,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    // Auto-generate seats (20 per row)
    const seatsPerRow = 20;
    const rows = Math.ceil(dto.totalQuantity / seatsPerRow);
    const seatsToCreate: any[] = [];
    let created = 0;
    for (let r = 0; r < rows && created < dto.totalQuantity; r++) {
      const rowName = String.fromCharCode(65 + r); // A, B, C...
      for (let s = 1; s <= seatsPerRow && created < dto.totalQuantity; s++) {
        seatsToCreate.push({
          eventId,
          venueId: event.venueId,
          tierId: tier.id,
          section: tier.name,
          rowName,
          seatNumber: s,
          status: SeatStatus.AVAILABLE,
        });
        created++;
      }
    }
    if (seatsToCreate.length > 0) {
      await this.prisma.seat.createMany({ data: seatsToCreate });
    }

    // Update event totals
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        totalTickets: (event.totalTickets || 0) + dto.totalQuantity,
        availableTickets: (event.availableTickets || 0) + dto.totalQuantity,
      },
    });

    return this.getEvent(eventId);
  }

  async publishEvent(eventId: string, user?: User): Promise<EventResponseDto> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTiers: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    this.assertEventOwner(event, user);
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT events can be published');
    }
    if (!event.ticketTiers?.length) {
      throw new BadRequestException('Event must have at least one ticket tier');
    }
    await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.ON_SALE, onSaleAt: new Date() },
    });
    return this.getEvent(eventId);
  }

  async cancelEvent(eventId: string, user?: User): Promise<EventResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    this.assertEventOwner(event, user);
    await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.CANCELLED },
    });
    return this.getEvent(eventId);
  }

  async updateEvent(eventId: string, dto: Partial<CreateEventDto>, user?: User): Promise<EventResponseDto> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    this.assertEventOwner(event, user);
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT events can be updated');
    }

    const data: any = {};
    if (dto.venueId) data.venueId = dto.venueId;
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.artistName !== undefined) data.artistName = dto.artistName;
    if (dto.category) data.category = dto.category;
    if (dto.eventDate) data.eventDate = new Date(dto.eventDate);
    if (dto.doorsOpenAt) data.doorsOpenAt = new Date(dto.doorsOpenAt);
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.maxTicketsPerUser !== undefined) data.maxTicketsPerUser = dto.maxTicketsPerUser;
    if (dto.queueEnabled !== undefined) data.queueEnabled = dto.queueEnabled;

    await this.prisma.event.update({ where: { id: eventId }, data });
    return this.getEvent(eventId);
  }

  async getEventEntity(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: true, organizer: true, ticketTiers: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  toResponse(e: any): EventResponseDto {
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      artistName: e.artistName,
      category: e.category,
      status: e.status,
      eventMode: e.eventMode,
      streamingUrl: e.streamingUrl,
      muxPlaybackId: e.muxPlaybackId,
      bannerUrl: e.bannerUrl,
      eventDate: e.eventDate,
      endDate: e.endDate,
      doorsOpenAt: e.doorsOpenAt,
      coverImageUrl: e.coverImageUrl,
      totalTickets: e.totalTickets,
      availableTickets: e.availableTickets,
      onSaleAt: e.onSaleAt,
      presaleAt: e.presaleAt,
      maxTicketsPerUser: e.maxTicketsPerUser,
      queueEnabled: e.queueEnabled,
      venue: e.venue ? this.venueService.toResponse(e.venue) : null,
      organizer: e.organizer ? this.organizerService.toResponse(e.organizer) : null,
      ticketTiers: e.ticketTiers?.map((t: any) => this.toTierResponse(t)) ?? [],
      schedules: e.schedules?.map((s: any) => this.toScheduleResponse(s)) ?? [],
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  toTierResponse(t: any): TicketTierResponseDto {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price),
      effectivePrice: getEffectivePrice(t),
      currency: t.currency,
      totalQuantity: t.totalQuantity,
      availableQuantity: t.availableQuantity,
      maxPerUser: t.maxPerUser,
      sortOrder: t.sortOrder,
      pricingPhase: t.pricingPhase,
      earlyBirdPrice: t.earlyBirdPrice ? Number(t.earlyBirdPrice) : null,
      lastMinutePrice: t.lastMinutePrice ? Number(t.lastMinutePrice) : null,
      earlyBirdEndDate: t.earlyBirdEndDate,
      lastMinuteStartDate: t.lastMinuteStartDate,
      tierType: t.tierType,
      zoneName: t.zoneName,
      zoneCapacity: t.zoneCapacity,
      groupMinQuantity: t.groupMinQuantity,
      groupDiscountPercent: t.groupDiscountPercent ? Number(t.groupDiscountPercent) : null,
    };
  }

  private toScheduleResponse(s: any): EventScheduleResponseDto {
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      performer: s.performer,
      dayNumber: s.dayNumber,
      startTime: s.startTime,
      endTime: s.endTime,
      sortOrder: s.sortOrder,
    };
  }
}
