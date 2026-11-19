import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Venue } from '../entities';
import { CreateVenueDto } from '../dto';
import { VenueResponseDto } from '../dto';

@Injectable()
export class VenueService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async listVenues(city?: string, country?: string): Promise<VenueResponseDto[]> {
    const where: any = {};
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (country) where.country = { equals: country, mode: 'insensitive' };
    const venues = await this.prisma.venue.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return venues.map((v) => this.toResponse(v as unknown as Venue));
  }

  async getVenue(venueId: string): Promise<VenueResponseDto> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    return this.toResponse(venue as unknown as Venue);
  }

  async createVenue(dto: CreateVenueDto): Promise<VenueResponseDto> {
    const saved = await this.prisma.venue.create({ data: dto });
    return this.toResponse(saved as unknown as Venue);
  }

  async updateVenue(venueId: string, dto: CreateVenueDto): Promise<VenueResponseDto> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    const saved = await this.prisma.venue.update({
      where: { id: venueId },
      data: dto,
    });
    return this.toResponse(saved as unknown as Venue);
  }

  async deleteVenue(venueId: string): Promise<void> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    await this.prisma.venue.delete({ where: { id: venueId } });
  }

  async getEntity(venueId: string): Promise<Venue> {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    return venue as unknown as Venue;
  }

  toResponse(v: Venue): VenueResponseDto {
    return {
      id: v.id,
      name: v.name,
      address: v.address,
      city: v.city,
      state: v.state,
      country: v.country,
      zipCode: v.zipCode,
      capacity: v.capacity,
      imageUrl: v.imageUrl,
      latitude: v.latitude,
      longitude: v.longitude,
    };
  }
}
