import type { BinnacleKind } from '@prisma/client';
import type { PrismaDb } from '../prisma/prisma.service';

export function addBinnacleNote(
  db: PrismaDb,
  appointmentId: string,
  authorName: string,
  text: string,
  kind: BinnacleKind = 'agenda',
) {
  return db.binnacleRecord.create({
    data: { appointmentId, authorName, text, kind },
  });
}
