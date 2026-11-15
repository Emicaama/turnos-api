import { Module } from '@nestjs/common';
import { AdmissionsModule } from '../admissions/admissions.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { SuppliesModule } from '../supplies/supplies.module';
import { NursingController } from './nursing.controller';
import { NursingService } from './nursing.service';

@Module({
  imports: [
    AdmissionsModule,
    PatientsModule,
    SuppliesModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [NursingController],
  providers: [NursingService],
})
export class NursingModule {}
