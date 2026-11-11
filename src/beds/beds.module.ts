import { Module } from '@nestjs/common';
import { BedsController } from './beds.controller';
import { BedsService } from './beds.service';

@Module({
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}
