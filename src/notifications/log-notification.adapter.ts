import { Injectable, Logger } from '@nestjs/common';
import { AppointmentNotification, NotificationPort } from './notification.port';

@Injectable()
export class LogNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(LogNotificationAdapter.name);

  notify(event: AppointmentNotification): Promise<void> {
    this.logger.log(
      `[${event.type}] turno=${event.appointmentId} ${event.message}`,
    );
    return Promise.resolve();
  }
}
