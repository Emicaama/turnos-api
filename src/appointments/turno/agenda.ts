import { Appointment, Prisma } from '@prisma/client';
import { ACTIVE_APPOINTMENT_STATUSES } from '../../common/enums/appointment-status.enum';
import { PrismaService } from '../../prisma/prisma.service';

export type Slot = {
  professionalId: string;
  branchId: string;
  startAt: Date;
  endAt: Date;
};

export async function lockAgenda(
  tx: Prisma.TransactionClient,
  professionalId: string,
  branchId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${professionalId}),
      hashtext(${branchId})
    ) IS NOT NULL AS locked
  `;
}

export function withAgendaLock<T>(
  prisma: PrismaService,
  professionalId: string,
  branchId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await lockAgenda(tx, professionalId, branchId);
      return fn(tx);
    },
    { timeout: 15_000 },
  );
}

export function findActiveOverlap(
  db: PrismaService | Prisma.TransactionClient,
  slot: Slot & { excludeId?: string },
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
  tx: Prisma.TransactionClient,
  appointmentId: string,
  authorName: string,
  text: string,
) {
  return tx.binnacleRecord.create({
    data: { appointmentId, authorName, text },
  });
}
