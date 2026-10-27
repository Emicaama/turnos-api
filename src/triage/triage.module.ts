import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';

@Module({
  imports: [PatientsModule, BranchesModule, NotificationsModule],
  controllers: [TriageController],
  providers: [TriageService],
})
export class TriageModule {}
