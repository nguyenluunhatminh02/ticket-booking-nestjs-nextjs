import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { DemandForecastService } from '../services/demand-forecast.service';
import { MlClientService } from '../services/ml-client.service';
import { User } from '../../auth/entities/user.entity';

/**
 * ML Controller — proxies to FastAPI ML microservice (port 8000).
 * Falls back to local NestJS heuristic services if ML service is down.
 */
@Controller('ml')
export class MlController {
  private readonly logger = new Logger(MlController.name);

  constructor(
    private readonly fraudService: FraudDetectionService,
    private readonly forecastService: DemandForecastService,
    private readonly mlClient: MlClientService,
  ) {}

  // ─── TRAINING (triggers FastAPI model training) ───────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('train/all')
  async trainAllModels() {
    try {
      return await this.mlClient.trainAll();
    } catch {
      return { status: 'ml_service_unavailable', message: 'FastAPI ML service is not running' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('train/fraud')
  async trainFraud() {
    try {
      return await this.mlClient.trainFraud();
    } catch {
      return { status: 'ml_service_unavailable' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('train/demand')
  async trainDemand() {
    try {
      return await this.mlClient.trainDemand();
    } catch {
      return { status: 'ml_service_unavailable' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('train/pricing')
  async trainPricing() {
    try {
      return await this.mlClient.trainPricing();
    } catch {
      return { status: 'ml_service_unavailable' };
    }
  }

  // ─── ML SERVICE STATUS ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getMlStatus() {
    try {
      const health = await this.mlClient.checkHealth();
      const models = await this.mlClient.getModelStatus();
      return { health, models };
    } catch {
      return {
        health: { status: 'unavailable' },
        fallback: 'Using local NestJS heuristic models',
      };
    }
  }

  // ─── FRAUD DETECTION ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('fraud/check')
  async checkMyFraudRisk(@CurrentUser() user: User) {
    try {
      return await this.mlClient.analyzeFraud(user.id);
    } catch {
      this.logger.debug('Falling back to local fraud service');
      return this.fraudService.analyzeUser(user.id);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('fraud/user/:userId')
  async checkUserFraudRisk(@Param('userId') userId: string) {
    try {
      return await this.mlClient.analyzeFraud(userId);
    } catch {
      return this.fraudService.analyzeUser(userId);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('fraud/report')
  async getFraudReport() {
    try {
      return await this.mlClient.getFraudReport();
    } catch {
      return this.fraudService.generateFraudReport();
    }
  }

  // ─── DEMAND FORECASTING ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('forecast/:eventId')
  async getEventForecast(@Param('eventId') eventId: string) {
    try {
      return await this.mlClient.forecastEvent(eventId);
    } catch {
      return this.forecastService.forecastEvent(eventId);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('forecast/:eventId/heatmap')
  async getDemandHeatmap(@Param('eventId') eventId: string) {
    try {
      return await this.mlClient.getDemandHeatmap(eventId);
    } catch {
      return this.forecastService.getDemandHeatmap(eventId);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('pricing/:eventId')
  async getPricingSignals(@Param('eventId') eventId: string) {
    try {
      return await this.mlClient.getPricingSignals(eventId);
    } catch {
      return this.forecastService.getPricingSignals(eventId);
    }
  }
}
