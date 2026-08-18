export const NOTIFICATION_PORT = 'NOTIFICATION_PORT';

export type AppointmentNotification = {
  type: 'created' | 'cancelled' | 'rescheduled' | 'status_changed';
  appointmentId: string;
  professionalId: string;
  patientId: string;
  message: string;
};

export interface NotificationPort {
  notify(event: AppointmentNotification): Promise<void>;
}
