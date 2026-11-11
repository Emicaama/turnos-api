import { BadRequestException } from '@nestjs/common';
import { Appointment, Prisma, WaitlistEntry } from '@prisma/client';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  AppointmentStatus,
} from '../common/enums/appointment-status.enum';
import type { PrismaDb } from '../prisma/prisma.service';

export type Range = {
  startAt: Date;
  endAt: Date;
};

export type Slot = Range & {
  professionalId: string;
  branchId: string;
  excludeId?: string;
};

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.Programado]: [
    AppointmentStatus.EnSalaDeEspera,
    AppointmentStatus.Cancelado,
  ],
  [AppointmentStatus.EnSalaDeEspera]: [
    AppointmentStatus.Atendido,
    AppointmentStatus.Cancelado,
  ],
  [AppointmentStatus.Atendido]: [],
  [AppointmentStatus.Cancelado]: [],
};

const STATUS_NOTES: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Programado]: 'Cambió el estado a programado',
  [AppointmentStatus.EnSalaDeEspera]: 'Anunció al paciente en sala de espera',
  [AppointmentStatus.Atendido]: 'Marcó el turno como atendido',
  [AppointmentStatus.Cancelado]: 'Canceló el turno',
};

export function isEntreturnoStart(minute: number): boolean {
  return minute === 15 || minute === 45;
}

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function canReschedule(status: AppointmentStatus): boolean {
  return status === AppointmentStatus.Programado;
}

export function transitionError(
  from: AppointmentStatus,
  to: AppointmentStatus,
): string {
  if (from === AppointmentStatus.Cancelado) {
    return 'Un turno cancelado no avanza';
  }
  if (ALLOWED_TRANSITIONS[from].length === 0) {
    return 'Un turno en estado final no avanza';
  }
  return `No se puede pasar de ${from} a ${to}`;
}

export function statusNote(next: AppointmentStatus): string {
  return STATUS_NOTES[next];
}

export function parseRange(start: string | Date, end: string | Date): Range {
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (!(startAt < endAt)) {
    throw new BadRequestException('endAt debe ser posterior a startAt');
  }
  return { startAt, endAt };
}

export async function joinWaitlist(
  tx: Prisma.TransactionClient,
  entry: Pick<
    WaitlistEntry,
    'patientId' | 'professionalId' | 'branchId' | 'day'
  >,
): Promise<WaitlistEntry> {
  const alreadyWaiting = await tx.waitlistEntry.findFirst({
    where: { ...entry, promotedAppointmentId: null },
  });
  return alreadyWaiting ?? tx.waitlistEntry.create({ data: entry });
}

export function findActiveOverlap(
  db: PrismaDb,
  slot: Slot,
): Promise<Appointment | null> {
  return db.appointment.findFirst({
    where: {
      professionalId: slot.professionalId,
      branchId: slot.branchId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startAt: { lt: slot.endAt },
      endAt: { gt: slot.startAt },
      ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
    },
  });
}
