import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators';

@Roles('ROLE_ADMIN')
@Controller('admin/events/:eventId/video')
export class AdminVideoController {
  constructor(private prisma: PrismaService) {}

  @Get('status')
  async getVideoStatus(@Param('eventId') eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    return {
      eventId,
      hasVideo: !!event?.muxPlaybackId,
      playbackId: event?.muxPlaybackId || null,
      assetId: event?.muxAssetId || null,
      status: event?.muxPlaybackId ? 'READY' : 'NONE',
    };
  }

  @Post('upload-url')
  async createUploadUrl(@Param('eventId') eventId: string) {
    return {
      uploadId: `upload-${Date.now()}`,
      url: `https://storage.example.com/uploads/${eventId}`,
    };
  }

  @Post('link-upload')
  async linkUpload(
    @Param('eventId') eventId: string,
    @Body('uploadId') uploadId: string,
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (event) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          muxPlaybackId: `playback-${uploadId}`,
          muxAssetId: `asset-${uploadId}`,
        },
      });
    }
    return {
      playbackId: `playback-${uploadId}`,
      assetId: `asset-${uploadId}`,
    };
  }

  @Post('from-url')
  async addFromUrl(
    @Param('eventId') eventId: string,
    @Body('videoUrl') videoUrl: string,
  ) {
    const playbackId = `playback-url-${Date.now()}`;
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (event) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          streamingUrl: videoUrl,
          muxPlaybackId: playbackId,
        },
      });
    }
    return {
      playbackId,
      status: 'PROCESSING',
    };
  }

  @Put()
  async updateVideoSettings(
    @Param('eventId') eventId: string,
    @Body() body: { playbackId?: string; assetId?: string; eventMode?: string },
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (event) {
      const data: any = {};
      if (body.playbackId) data.muxPlaybackId = body.playbackId;
      if (body.assetId) data.muxAssetId = body.assetId;
      if (body.eventMode) data.eventMode = body.eventMode;
      await this.prisma.event.update({ where: { id: eventId }, data });
    }
    return { message: 'Updated' };
  }

  @Delete()
  async removeVideo(
    @Param('eventId') eventId: string,
    @Query('deleteMuxAsset', new DefaultValuePipe(false), ParseBoolPipe) deleteMuxAsset: boolean,
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (event) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          muxPlaybackId: null,
          muxAssetId: null,
          streamingUrl: null,
        },
      });
    }
    return { message: 'Video removed' };
  }
}
