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
    const line = `[${event.type}] ${subject} ${event.message}`;
    if (event.type === 'guardia') {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
    return Promise.resolve();
  }
}
