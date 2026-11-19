import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticationService } from '../services/auth.service';
import { ApiResponseDto, UserResponseDto } from '../dto/response.dto';
import { UpdateProfileDto, DeactivateAccountDto } from '../dto/auth.dto';
import { ResourceNotFoundException } from '../../common/exceptions';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private prisma: PrismaService,
    private authService: AuthenticationService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() currentUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user) throw new ResourceNotFoundException('User');
    return ApiResponseDto.success(UserResponseDto.from(user as any));
  }

  @Get(':id')
  @Roles('ROLE_ADMIN')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user) throw new ResourceNotFoundException('User');
    return ApiResponseDto.success(UserResponseDto.from(user as any));
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@CurrentUser() currentUser: any, @Body() dto: UpdateProfileDto) {
    const user = await this.authService.updateProfile(currentUser.id, dto);
    return ApiResponseDto.success(UserResponseDto.from(user));
  }

  @Post('me/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate account' })
  async deactivate(@CurrentUser() currentUser: any, @Body() dto: DeactivateAccountDto) {
    await this.authService.deactivateAccount(currentUser.id, dto.password);
    return ApiResponseDto.success(null, 'Account deactivated');
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload avatar' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          const filename = `${uuid()}${extname(file.originalname)}`;
          cb(null, filename);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        // Validate both MIME type and file extension
        const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase() : '';
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
        } else if (!allowedExt.includes(ext)) {
          cb(new Error('Invalid file extension. Allowed: ' + allowedExt.join(', ')), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadAvatar(@CurrentUser() currentUser: any, @UploadedFile() file: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { roles: true },
    });
    if (!user) throw new ResourceNotFoundException('User');

    // Delete old avatar
    if (user.profilePicture) {
      const oldPath = join(process.cwd(), user.profilePicture);
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }

    const updated = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: { profilePicture: `uploads/avatars/${file.filename}` },
      include: { roles: true },
    });
    return ApiResponseDto.success(UserResponseDto.from(updated as any));
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Delete avatar' })
  async deleteAvatar(@CurrentUser() currentUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { roles: true },
    });
    if (!user) throw new ResourceNotFoundException('User');

    if (user.profilePicture) {
      const oldPath = join(process.cwd(), user.profilePicture);
      if (existsSync(oldPath)) unlinkSync(oldPath);
      await this.prisma.user.update({
        where: { id: currentUser.id },
        data: { profilePicture: null },
      });
    }

    const updated = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { roles: true },
    });
    return ApiResponseDto.success(UserResponseDto.from(updated as any));
  }
}
