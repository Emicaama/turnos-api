import { Prisma } from '@prisma/client';

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
