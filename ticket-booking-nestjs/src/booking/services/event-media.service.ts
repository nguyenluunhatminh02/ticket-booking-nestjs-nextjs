import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventMedia } from '../entities';
import { EventMediaResponseDto } from '../dto/response/event-media-response.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const IMAGE_MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const VIDEO_MIME_EXTENSIONS: Record<string, string[]> = {
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
};

@Injectable()
export class EventMediaService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'event-media');

  constructor(
    private prisma: PrismaService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private validateFile(file: Express.Multer.File, allowed: Record<string, string[]>): void {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = path.extname(file.originalname).toLowerCase();
    const extensions = allowed[file.mimetype];
    if (!extensions || !extensions.includes(ext)) {
      throw new BadRequestException('Unsupported file type');
    }
  }

  private async assertEventAccess(eventId: string, user: any): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const roles: string[] = user?.roles || [];
    if (event.createdById !== user?.id && !roles.includes('ROLE_ADMIN')) {
      throw new BadRequestException('Not authorized to manage this event');
    }
  }

  async uploadImage(
    eventId: string,
    file: Express.Multer.File,
    user: any,
    caption?: string,
    sortOrder?: number,
  ): Promise<EventMediaResponseDto> {
    this.validateFile(file, IMAGE_MIME_EXTENSIONS);
    await this.assertEventAccess(eventId, user);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const destPath = path.join(this.uploadDir, filename);
    fs.writeFileSync(destPath, file.buffer);

    const saved = await this.prisma.eventMedia.create({
      data: {
        eventId,
        mediaType: 'IMAGE' as any,
        filePath: `/uploads/event-media/${filename}`,
        fileName: file.originalname,
        caption: caption || undefined,
        sortOrder: sortOrder || 0,
        fileSize: file.size,
        contentType: file.mimetype,
      },
    });
    return this.toResponse(saved as unknown as EventMedia);
  }

  async uploadVideo(
    eventId: string,
    file: Express.Multer.File,
    user: any,
    caption?: string,
  ): Promise<EventMediaResponseDto> {
    this.validateFile(file, VIDEO_MIME_EXTENSIONS);
    await this.assertEventAccess(eventId, user);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const destPath = path.join(this.uploadDir, filename);
    fs.writeFileSync(destPath, file.buffer);

    const saved = await this.prisma.eventMedia.create({
      data: {
        eventId,
        mediaType: 'VIDEO' as any,
        filePath: `/uploads/event-media/${filename}`,
        fileName: file.originalname,
        caption: caption || undefined,
        sortOrder: 0,
        fileSize: file.size,
        contentType: file.mimetype,
      },
    });
    return this.toResponse(saved as unknown as EventMedia);
  }

  async getEventMedia(eventId: string): Promise<EventMediaResponseDto[]> {
    const media = await this.prisma.eventMedia.findMany({
      where: { eventId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return media.map((m) => this.toResponse(m as unknown as EventMedia));
  }

  async updateCaption(mediaId: string, caption: string, user: any): Promise<EventMediaResponseDto> {
    const media = await this.prisma.eventMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.assertEventAccess(media.eventId, user);
    const saved = await this.prisma.eventMedia.update({
      where: { id: mediaId },
      data: { caption },
    });
    return this.toResponse(saved as unknown as EventMedia);
  }

  async deleteMedia(mediaId: string, user: any): Promise<void> {
    const media = await this.prisma.eventMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.assertEventAccess(media.eventId, user);

    const diskPath = path.join(process.cwd(), media.filePath);
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }

    await this.prisma.eventMedia.delete({ where: { id: mediaId } });
  }

  private toResponse(m: EventMedia): EventMediaResponseDto {
    return {
      id: m.id,
      eventId: m.eventId,
      mediaType: m.mediaType,
      filePath: m.filePath,
      fileName: m.fileName,
      fileSize: m.fileSize,
      contentType: m.contentType,
      caption: m.caption,
      sortOrder: m.sortOrder,
      url: m.filePath,
      createdAt: m.createdAt,
    };
  }
}
