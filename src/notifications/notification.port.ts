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

export type TriageNotification = {
  type: 'triage';
  patientId: string;
  branchId: string;
  message: string;
};

export type NotificationEvent = AppointmentNotification | TriageNotification;

export interface NotificationPort {
  notify(event: NotificationEvent): Promise<void>;
}
