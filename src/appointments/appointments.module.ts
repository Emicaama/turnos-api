import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BranchesModule } from '../branches/branches.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ColaService } from './cola/cola.service';
import { EntreturnoService } from './entreturno/entreturno.service';
import { ProfessionalsAgendaController } from './professionals-agenda.controller';
import { StatusService } from './status/status.service';
import { TurnoService } from './turno/turno.service';

@Module({
  imports: [
    PatientsModule,
    ProfessionalsModule,
    BranchesModule,
    AvailabilityModule,
    NotificationsModule,
  ],
  controllers: [AppointmentsController, ProfessionalsAgendaController],
  providers: [
    TurnoService,
    EntreturnoService,
    ColaService,
    StatusService,
    AppointmentsService,
  ],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
