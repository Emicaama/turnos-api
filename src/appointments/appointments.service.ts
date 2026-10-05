import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { EntreturnoService } from './entreturno/entreturno.service';
import { StatusService } from './status/status.service';
import type { BookingResult } from './turno/booking-result';
import { CreateAppointmentDto } from './turno/dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './turno/dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './turno/dto/update-appointment.dto';
import { TurnoService } from './turno/turno.service';

export type { BookingResult };

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly turnos: TurnoService,
    private readonly entreturnos: EntreturnoService,
    private readonly estados: StatusService,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    actor: AuthUser,
  ): Promise<BookingResult> {
    const range = await this.turnos.prepare(dto, actor);
    if (dto.entreturno) {
      return this.entreturnos.create(dto, range, actor);
    }
    return this.turnos.bookOrWait(dto, range, actor);
  }

  list(query: ListAppointmentsQueryDto, actor: AuthUser) {
    return this.turnos.list(query, actor);
  }

  agenda(professionalId: string, from: string, to: string, actor: AuthUser) {
    return this.turnos.agenda(professionalId, from, to, actor);
  }

  findById(id: string, actor: AuthUser) {
    return this.turnos.findById(id, actor);
  }

  async update(id: string, dto: UpdateAppointmentDto, actor: AuthUser) {
    const current = await this.turnos.findById(id, actor);
    if (dto.startAt || dto.endAt) {
      return this.turnos.reschedule(current, dto, actor);
    }
    if (dto.status) {
      return this.estados.changeStatus(current, dto.status, actor);
    }
    if (dto.notes !== undefined) {
      return this.turnos.updateNotes(current, dto.notes);
    }
    return current;
  }

  async cancel(id: string, actor: AuthUser) {
    const current = await this.turnos.findById(id, actor);
    if (actor.role === Role.Profesional) {
      throw new ForbiddenException('El profesional no cancela turnos');
    }
    return this.estados.changeStatus(current, AppointmentStatus.Cancelado, actor);
  }
}
