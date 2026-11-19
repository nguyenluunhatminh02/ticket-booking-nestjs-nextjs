import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { Roles } from '../../common/decorators';
import { DashboardService } from '../services/dashboard.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('ROLE_ADMIN')
  @Get('dashboard')
  async getDashboard() {
    return this.dashboardService.getDashboardStats();
  }

  @Roles('ROLE_ADMIN')
  @Get('analytics/event/:eventId')
  async getEventAnalytics(@Param('eventId') eventId: string) {
    const results = await this.dashboardService.getRevenueAnalytics(eventId);
    return results[0] || {};
  }

  @Roles('ROLE_ADMIN')
  @Get('analytics/categories')
  async getCategoryAnalytics() {
    return this.dashboardService.getCategoryAnalytics();
  }
}
