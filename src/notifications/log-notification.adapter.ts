import { Injectable, Logger } from '@nestjs/common';
import { NotificationEvent, NotificationPort } from './notification.port';

@Injectable()
export class LogNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(LogNotificationAdapter.name);

  notify(event: NotificationEvent): Promise<void> {
    const subject =
      event.type === 'guardia'
        ? `paciente=${event.patientId}`
        : `turno=${event.appointmentId}`;
    this.logger.log(`[${event.type}] ${subject} ${event.message}`);
    return Promise.resolve();
  }
}
