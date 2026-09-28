import { Module } from '@nestjs/common';
import { BinnacleModule } from '../binnacle/binnacle.module';
import { AvailabilityModule } from '../availability/availability.module';
import { BranchesModule } from '../branches/branches.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ProfessionalsAgendaController } from './professionals-agenda.controller';

@Module({
  imports: [
    PatientsModule,
    ProfessionalsModule,
    BranchesModule,
    AvailabilityModule,
    BinnacleModule,
    NotificationsModule,
  ],
  controllers: [AppointmentsController, ProfessionalsAgendaController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
