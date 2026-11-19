import { Module } from '@nestjs/common';

import { MlClientService } from './services/ml-client.service';
import { FraudDetectionService } from './services/fraud-detection.service';
import { DemandForecastService } from './services/demand-forecast.service';
import { MlController } from './controllers/ml.controller';

const services = [MlClientService, FraudDetectionService, DemandForecastService];

@Module({
  controllers: [MlController],
  providers: [...services],
  exports: [...services],
})
export class MlModule {}
