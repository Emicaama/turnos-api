import { AppointmentStatus } from '../common/enums/appointment-status.enum';

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.Pendiente]: [
    AppointmentStatus.Confirmado,
    AppointmentStatus.Cancelado,
  ],
  [AppointmentStatus.Confirmado]: [
    AppointmentStatus.Completado,
    AppointmentStatus.Ausente,
    AppointmentStatus.Cancelado,
  ],
  [AppointmentStatus.Completado]: [],
  [AppointmentStatus.Ausente]: [],
  [AppointmentStatus.Cancelado]: [],
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED[from].includes(to);
}

export function canReschedule(status: AppointmentStatus): boolean {
  return (
    status === AppointmentStatus.Pendiente ||
    status === AppointmentStatus.Confirmado
  );
}
