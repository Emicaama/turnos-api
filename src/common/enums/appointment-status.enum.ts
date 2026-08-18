export enum AppointmentStatus {
  Pendiente = 'pendiente',
  Confirmado = 'confirmado',
  Completado = 'completado',
  Ausente = 'ausente',
  Cancelado = 'cancelado',
}

export const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.Pendiente,
  AppointmentStatus.Confirmado,
] as const;
