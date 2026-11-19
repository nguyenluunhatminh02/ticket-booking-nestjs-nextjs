import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { CommentService } from '../services/comment.service';
import { CreateCommentDto } from '../dto';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../auth/entities/user.entity';

@Controller('events/:eventId/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get()
  async getComments(
    @Param('eventId') eventId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.commentService.getCommentsByEvent(eventId, page, size);
  }

  @Public()
  @Get('rating')
  async getAverageRating(@Param('eventId') eventId: string) {
    const averageRating = await this.commentService.getAverageRating(eventId);
    return { averageRating };
  }

  @Get('eligibility')
  async checkEligibility(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ) {
    const canComment = await this.commentService.canUserComment(eventId, user.id);
    return { canComment };
  }

  @Post()
  async createComment(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentService.createComment(eventId, dto, user);
  }

  @Put(':commentId')
  async updateComment(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @Body('content') content: string,
    @CurrentUser() user: User,
  ) {
    return this.commentService.updateComment(eventId, commentId, content, user.id);
  }

  @Delete(':commentId')
  async deleteComment(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ) {
    return this.commentService.deleteComment(eventId, commentId, user.id);
  }
}
