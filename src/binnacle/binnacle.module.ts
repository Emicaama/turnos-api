import { Module } from '@nestjs/common';
import { BinnacleController } from './binnacle.controller';
import { BinnacleService } from './binnacle.service';

@Module({
  controllers: [BinnacleController],
  providers: [BinnacleService],
  exports: [BinnacleService],
})
export class BinnacleModule {}