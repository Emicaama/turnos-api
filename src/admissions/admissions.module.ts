import { Module } from '@nestjs/common';
import { BedsModule } from '../beds/beds.module';
import { PatientsModule } from '../patients/patients.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { ProtocolsController } from './protocols.controller';
import { ProtocolsService } from './protocols.service';

@Module({
  imports: [PatientsModule, BedsModule],
  controllers: [AdmissionsController, ProtocolsController],
  providers: [AdmissionsService, ProtocolsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
