import { AppointmentStatus } from '../common/enums/appointment-status.enum';

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
