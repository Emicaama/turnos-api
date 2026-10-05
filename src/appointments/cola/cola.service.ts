import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Appointment, Prisma, WaitlistEntry } from '@prisma/client';
import type { AuthUser } from '../../auth/auth-user';
import { clinicDay } from '../../availability/time-in-zone';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';
import { NOTIFICATION_PORT } from '../../notifications/notification.port';
import type { NotificationPort } from '../../notifications/notification.port';
import { findActiveOverlap, writeNote } from '../turno/agenda';
import { CreateAppointmentDto } from '../turno/dto/create-appointment.dto';

@Injectable()
export class ColaService {
  constructor(
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async enqueue(
    tx: Prisma.TransactionClient,
    dto: CreateAppointmentDto,
    startAt: Date,
  ): Promise<WaitlistEntry> {
    const day = clinicDay(startAt, this.timeZone());
    const existing = await tx.waitlistEntry.findFirst({
      where: {
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        day,
        promotedAppointmentId: null,
      },
    });
    if (existing) {
      return existing;
    }
    return tx.waitlistEntry.create({
      data: {
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        day,
      },
    });
  }

  async promoteFirst(
    tx: Prisma.TransactionClient,
    freed: Appointment,
    actor: AuthUser,
  ): Promise<Appointment | null> {
    const clash = await findActiveOverlap(tx, {
      professionalId: freed.professionalId,
      branchId: freed.branchId,
      startAt: freed.startAt,
      endAt: freed.endAt,
    });
    if (clash) {
      return null;
    }
    const day = clinicDay(freed.startAt, this.timeZone());
    const entry = await tx.waitlistEntry.findFirst({
      where: {
        professionalId: freed.professionalId,
        branchId: freed.branchId,
        day,
        promotedAppointmentId: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!entry) {
      return null;
    }
    const appointment = await tx.appointment.create({
      data: {
        patientId: entry.patientId,
        professionalId: freed.professionalId,
        branchId: freed.branchId,
        startAt: freed.startAt,
        endAt: freed.endAt,
        status: AppointmentStatus.Programado,
        notes: 'Asignado desde la lista de espera',
      },
    });
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { promotedAppointmentId: appointment.id },
    });
    await writeNote(
      tx,
      appointment.id,
      actor.name,
      'Asignó el horario liberado desde la lista de espera',
    );
    await writeNote(
      tx,
      freed.id,
      actor.name,
      'El horario pasó al primero de la lista de espera',
    );
    return appointment;
  }

  async notifyPromoted(promoted: Appointment | null) {
    if (!promoted) {
      return;
    }
    await this.notifications.notify({
      type: 'waitlist_promoted',
      appointmentId: promoted.id,
      professionalId: promoted.professionalId,
      patientId: promoted.patientId,
      message:
        'Lista de espera: avisar al paciente. Quedó programado en el horario liberado',
    });
  }

  private timeZone() {
    return this.config.get<string>('CLINIC_TZ') ?? 'UTC';
  }
}
