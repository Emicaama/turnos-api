import { BadRequestException } from '@nestjs/common';
import { Appointment, Prisma, WaitlistEntry } from '@prisma/client';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  AppointmentStatus,
} from '../common/enums/appointment-status.enum';
import { PrismaService } from '../prisma/prisma.service';

export type Range = {
  startAt: Date;
  endAt: Date;
};

export type Slot = Range & {
  professionalId: string;
  branchId: string;
  excludeId?: string;
};

type Db = PrismaService | Prisma.TransactionClient;

export type SlotOutcome = 'programado' | 'lista_de_espera';

export function chooseSlot(busy: boolean): SlotOutcome {
  return busy ? 'lista_de_espera' : 'programado';
}

export function takenJustNow(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

export function isEntreturnoStart(minute: number): boolean {
  return minute === 15 || minute === 45;
}

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
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

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED[from].includes(to);
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
  if (ALLOWED[from].length === 0) {
    return 'Un turno en estado final no avanza';
  }
  return `No se puede pasar de ${from} a ${to}`;
}

export function statusNote(next: AppointmentStatus): string {
  switch (next) {
    case AppointmentStatus.Cancelado:
      return 'Canceló el turno';
    case AppointmentStatus.EnSalaDeEspera:
      return 'Anunció al paciente en sala de espera';
    case AppointmentStatus.Atendido:
      return 'Marcó el turno como atendido';
    default:
      return `Cambió el estado a ${next}`;
  }
}

export function parseRange(startIso: string, endIso: string): Range {
  const startAt = new Date(startIso);
  const endAt = new Date(endIso);
  if (!(startAt < endAt)) {
    throw new BadRequestException('endAt debe ser posterior a startAt');
  }
  return { startAt, endAt };
}

export function inTransaction<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 15_000,
  });
}

export async function enqueue(
  tx: Prisma.TransactionClient,
  entry: {
    patientId: string;
    professionalId: string;
    branchId: string;
    day: string;
  },
): Promise<WaitlistEntry> {
  const current = await tx.waitlistEntry.findFirst({
    where: { ...entry, promotedAppointmentId: null },
  });
  if (current) {
    return current;
  }
  return tx.waitlistEntry.create({ data: entry });
}

export function findActiveOverlap(
  db: Db,
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

export function writeNote(
  db: Db,
  appointmentId: string,
  authorName: string,
  text: string,
) {
  return db.binnacleRecord.create({
    data: { appointmentId, authorName, text },
  });
}
