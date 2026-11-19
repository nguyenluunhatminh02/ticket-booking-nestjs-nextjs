import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { EventMediaService } from '../services/event-media.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('events/:eventId/media')
export class EventMediaController {
  constructor(private readonly eventMediaService: EventMediaService) {}

  @Get()
  async getMedia(
    @Param('eventId') eventId: string,
    @Query('type') type?: string,
  ) {
    const media = await this.eventMediaService.getEventMedia(eventId);
    if (type) {
      return media.filter((m) => m.mediaType === type.toUpperCase());
    }
    return media;
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImages(
    @Param('eventId') eventId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
  ) {
    const results = [];
    for (const file of files || []) {
      const result = await this.eventMediaService.uploadImage(eventId, file, user);
      results.push(result);
    }
    return results;
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Post('videos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
  async uploadVideo(
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Body('caption') caption?: string,
  ) {
    return this.eventMediaService.uploadVideo(eventId, file, user, caption);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Put(':mediaId')
  async updateCaption(
    @Param('mediaId') mediaId: string,
    @Body('caption') caption: string,
    @CurrentUser() user: User,
  ) {
    return this.eventMediaService.updateCaption(mediaId, caption, user);
  }

  @Roles('ROLE_ADMIN', 'ROLE_ORGANIZER')
  @Delete(':mediaId')
  async deleteMedia(@Param('mediaId') mediaId: string, @CurrentUser() user: User) {
    await this.eventMediaService.deleteMedia(mediaId, user);
    return { message: 'Media deleted' };
  }
}
