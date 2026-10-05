import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Appointment } from '@prisma/client';
import type { AuthUser } from '../../auth/auth-user';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';
import { Role } from '../../common/enums/role.enum';
import { NOTIFICATION_PORT } from '../../notifications/notification.port';
import type { NotificationPort } from '../../notifications/notification.port';
import { PrismaService } from '../../prisma/prisma.service';
import { ColaService } from '../cola/cola.service';
import { withAgendaLock, writeNote } from '../turno/agenda';
import { canTransition, statusNote, transitionError } from './status-transitions';

@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cola: ColaService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async changeStatus(
    current: Appointment,
    next: AppointmentStatus,
    actor: AuthUser,
  ) {
    if (
      actor.role === Role.Profesional &&
      next !== AppointmentStatus.Atendido
    ) {
      throw new ForbiddenException(
        'El profesional solo puede marcar el turno como atendido',
      );
    }
    this.assertTransition(current.status as AppointmentStatus, next);

    if (next !== AppointmentStatus.Cancelado) {
      const updated = await this.prisma.appointment.update({
        where: { id: current.id },
        data: { status: next },
      });
      await this.prisma.binnacleRecord.create({
        data: {
          appointmentId: updated.id,
          authorName: actor.name,
          text: statusNote(next),
        },
      });
      await this.notifyStatus(updated, next);
      return updated;
    }

    const { updated, promoted } = await withAgendaLock(
      this.prisma,
      current.professionalId,
      current.branchId,
      async (tx) => {
        const fresh = await tx.appointment.findUnique({
          where: { id: current.id },
        });
        if (!fresh) {
          throw new NotFoundException('Turno no encontrado');
        }
        this.assertTransition(fresh.status as AppointmentStatus, next);
        const cancelled = await tx.appointment.update({
          where: { id: fresh.id },
          data: { status: AppointmentStatus.Cancelado },
        });
        await writeNote(tx, cancelled.id, actor.name, statusNote(next));
        const filled = await this.cola.promoteFirst(tx, cancelled, actor);
        return { updated: cancelled, promoted: filled };
      },
    );

    await this.notifyStatus(updated, next);
    await this.cola.notifyPromoted(promoted);
    return promoted ? { ...updated, promoted } : updated;
  }

  private async notifyStatus(updated: Appointment, next: AppointmentStatus) {
    const enSala = next === AppointmentStatus.EnSalaDeEspera;
    await this.notifications.notify({
      type:
        next === AppointmentStatus.Cancelado ? 'cancelled' : 'status_changed',
      appointmentId: updated.id,
      professionalId: updated.professionalId,
      patientId: updated.patientId,
      message: enSala
        ? 'Paciente en sala de espera. Avisar al consultorio.'
        : `Estado: ${next}`,
    });
  }

  private assertTransition(from: AppointmentStatus, to: AppointmentStatus) {
    if (!canTransition(from, to)) {
      throw new BadRequestException(transitionError(from, to));
    }
  }
}
