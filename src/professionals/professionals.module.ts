import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';

@Module({
  imports: [UsersModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
export class ProfessionalsModule {}
