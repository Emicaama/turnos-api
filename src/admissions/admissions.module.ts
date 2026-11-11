import { Module } from '@nestjs/common';
import { BedsModule } from '../beds/beds.module';
import { PatientsModule } from '../patients/patients.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';

@Module({
  imports: [PatientsModule, BedsModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
