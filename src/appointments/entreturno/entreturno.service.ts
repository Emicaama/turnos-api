import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../auth/auth-user';
import { clockMinute } from '../../availability/time-in-zone';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  AppointmentStatus,
} from '../../common/enums/appointment-status.enum';
import { NOTIFICATION_PORT } from '../../notifications/notification.port';
import type { NotificationPort } from '../../notifications/notification.port';
import { PrismaService } from '../../prisma/prisma.service';
import { withAgendaLock, writeNote } from '../turno/agenda';
import type { BookingResult, Range } from '../turno/booking-result';
import { CreateAppointmentDto } from '../turno/dto/create-appointment.dto';
import { isEntreturnoStart } from './entreturno';

@Injectable()
export class EntreturnoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    range: Range,
    actor: AuthUser,
  ): Promise<BookingResult> {
    const minute = clockMinute(range.startAt, this.timeZone());
    if (!isEntreturnoStart(minute)) {
      throw new BadRequestException(
        'Un entreturno solo puede empezar a los :15 o a los :45',
      );
    }

    const { appointment, acortado } = await withAgendaLock(
      this.prisma,
      dto.professionalId,
      dto.branchId,
      async (tx) => {
        const neighbor = await tx.appointment.findFirst({
          where: {
            professionalId: dto.professionalId,
            branchId: dto.branchId,
            status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
            startAt: { lt: range.startAt },
            endAt: { gt: range.startAt },
          },
        });
        if (!neighbor) {
          throw new BadRequestException(
            'No hay un turno en curso para acortar en ese horario',
          );
        }
        if (neighbor.endAt.getTime() !== range.endAt.getTime()) {
          throw new BadRequestException(
            'El entreturno tiene que terminar cuando terminaba el turno que se acorta',
          );
        }

        const shortened = await tx.appointment.update({
          where: { id: neighbor.id },
          data: { endAt: range.startAt, acortado: true },
        });
        const created = await tx.appointment.create({
          data: {
            patientId: dto.patientId,
            professionalId: dto.professionalId,
            branchId: dto.branchId,
            startAt: range.startAt,
            endAt: range.endAt,
            status: AppointmentStatus.Programado,
            entreturno: true,
            notes: dto.notes,
          },
        });
        await writeNote(
          tx,
          shortened.id,
          actor.name,
          'Se acortó por un entreturno',
        );
        await writeNote(tx, created.id, actor.name, 'Creó un entreturno');
        return { appointment: created, acortado: shortened };
      },
    );

    await this.notifications.notify({
      type: 'created',
      appointmentId: appointment.id,
      professionalId: dto.professionalId,
      patientId: dto.patientId,
      message: 'Entreturno programado',
    });
    await this.notifications.notify({
      type: 'status_changed',
      appointmentId: acortado.id,
      professionalId: acortado.professionalId,
      patientId: acortado.patientId,
      message: 'Turno acortado por un entreturno',
    });
    return { result: 'programado', appointment, acortado };
  }

  private timeZone() {
    return this.config.get<string>('CLINIC_TZ') ?? 'UTC';
  }
}
