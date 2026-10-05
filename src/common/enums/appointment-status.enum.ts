export enum AppointmentStatus {
  Programado = 'programado',
  EnSalaDeEspera = 'en_sala_de_espera',
  Atendido = 'atendido',
  Cancelado = 'cancelado',
}

export const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.Programado,
  AppointmentStatus.EnSalaDeEspera,
] as const;
