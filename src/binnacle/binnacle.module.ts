import { Module } from '@nestjs/common';
import { BinnacleController } from './binnacle.controller';
import { BinnacleService } from './binnacle.service';

@Module({
  controllers: [BinnacleController],
  providers: [BinnacleService],
})
export class BinnacleModule {}
