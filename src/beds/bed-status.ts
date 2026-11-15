import type { BedStatus } from '@prisma/client';

const MANUAL_TRANSITIONS: Record<BedStatus, BedStatus[]> = {
  disponible: ['bloqueada'],
  ocupada: [],
  en_limpieza: ['disponible'],
  bloqueada: ['disponible'],
};

export function canChangeBedStatus(from: BedStatus, to: BedStatus): boolean {
  return MANUAL_TRANSITIONS[from].includes(to);
}

export function bedStatusError(from: BedStatus, to: BedStatus): string {
  if (from === 'ocupada') {
    return 'Una cama ocupada solo se libera con el alta del paciente';
  }
  return `No se puede pasar la cama de ${from} a ${to}`;
}
