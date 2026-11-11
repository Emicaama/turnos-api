import { Prisma } from '@prisma/client';

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return hasPrismaCode(error, 'P2002');
}

export function isSerializationConflict(error: unknown): boolean {
  return hasPrismaCode(error, 'P2034');
}
