export const NOTIFICATION_PORT = 'NOTIFICATION_PORT';

export type AppointmentNotification = {
  type:
    | 'created'
    | 'cancelled'
    | 'rescheduled'
    | 'status_changed'
    | 'waitlist_joined'
    | 'waitlist_promoted';
  appointmentId: string;
  professionalId: string;
  patientId: string;
  message: string;
};

export interface NotificationPort {
  notify(event: AppointmentNotification): Promise<void>;
}
