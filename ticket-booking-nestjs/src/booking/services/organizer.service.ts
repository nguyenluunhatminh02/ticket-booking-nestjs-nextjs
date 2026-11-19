import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Organizer } from '../entities';
import { User } from '../../auth/entities/user.entity';
import { CreateOrganizerDto } from '../dto';
import { OrganizerResponseDto } from '../dto';

@Injectable()
export class OrganizerService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async listOrganizers(
    search?: string,
    page = 0,
    size = 20,
  ): Promise<{ content: OrganizerResponseDto[]; totalElements: number }> {
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    const [organizers, total] = await Promise.all([
      this.prisma.organizer.findMany({
        where,
        include: { user: true },
        orderBy: { name: 'asc' },
        skip: page * size,
        take: size,
      }),
      this.prisma.organizer.count({ where }),
    ]);
    return {
      content: organizers.map((o: any) => this.toResponse(o as unknown as Organizer)),
      totalElements: total,
    };
  }

  async getOrganizer(id: string, currentUserId?: string): Promise<OrganizerResponseDto> {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!organizer) throw new NotFoundException('Organizer not found');
    const resp = this.toResponse(organizer as unknown as Organizer);
    if (currentUserId) {
      resp.following = await this.isFollowing(currentUserId, id);
    }
    return resp;
  }

  async createOrganizer(dto: CreateOrganizerDto, user: User): Promise<OrganizerResponseDto> {
    const saved = await this.prisma.organizer.create({
      data: {
        ...dto,
        userId: user.id,
      },
    });
    return this.toResponse(saved as unknown as Organizer);
  }

  async updateOrganizer(
    id: string,
    dto: CreateOrganizerDto,
    userId: string,
  ): Promise<OrganizerResponseDto> {
    const organizer = await this.prisma.organizer.findUnique({ where: { id } });
    if (!organizer) throw new NotFoundException('Organizer not found');
    if (organizer.userId !== userId) throw new BadRequestException('Not the owner');
    const saved = await this.prisma.organizer.update({
      where: { id },
      data: dto,
    });
    return this.toResponse(saved as unknown as Organizer);
  }

  async followOrganizer(id: string, user: User): Promise<OrganizerResponseDto> {
    const organizer = await this.prisma.organizer.findUnique({ where: { id } });
    if (!organizer) throw new NotFoundException('Organizer not found');

    const alreadyFollowing = await this.isFollowing(user.id, id);
    let updated = organizer;
    if (!alreadyFollowing) {
      updated = await this.prisma.$transaction(async (tx: any) => {
        await tx.organizerFollower.create({
          data: { userId: user.id, organizerId: id },
        });
        return tx.organizer.update({
          where: { id },
          data: { followerCount: { increment: 1 } },
        });
      });
    }
    const resp = this.toResponse(updated as unknown as Organizer);
    resp.following = true;
    return resp;
  }

  async unfollowOrganizer(id: string, user: User): Promise<OrganizerResponseDto> {
    const organizer = await this.prisma.organizer.findUnique({ where: { id } });
    if (!organizer) throw new NotFoundException('Organizer not found');

    const alreadyFollowing = await this.isFollowing(user.id, id);
    let updated = organizer;
    if (alreadyFollowing) {
      updated = await this.prisma.$transaction(async (tx: any) => {
        await tx.organizerFollower.delete({
          where: { userId_organizerId: { userId: user.id, organizerId: id } },
        });
        return tx.organizer.update({
          where: { id },
          data: { followerCount: Math.max(0, (organizer.followerCount || 0) - 1) },
        });
      });
    }
    const resp = this.toResponse(updated as unknown as Organizer);
    resp.following = false;
    return resp;
  }

  private async isFollowing(userId: string, organizerId: string): Promise<boolean> {
    const record = await this.prisma.organizerFollower.findUnique({
      where: { userId_organizerId: { userId, organizerId } },
    });
    return !!record;
  }

  toResponse(o: Organizer): OrganizerResponseDto {
    return {
      id: o.id,
      userId: o.userId,
      name: o.name,
      description: o.description,
      logoUrl: o.logoUrl,
      website: o.website,
      contactEmail: o.contactEmail,
      contactPhone: o.contactPhone,
      followerCount: o.followerCount || 0,
      verified: o.verified || false,
      following: false,
    };
  }
}
