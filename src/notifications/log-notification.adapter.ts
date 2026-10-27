import { Injectable, Logger } from '@nestjs/common';
import { NotificationEvent, NotificationPort } from './notification.port';

@Injectable()
export class LogNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(LogNotificationAdapter.name);

  notify(event: NotificationEvent): Promise<void> {
    if (event.type === 'triage') {
      this.logger.log(`[triage] paciente=${event.patientId} ${event.message}`);
      return Promise.resolve();
    }
    this.logger.log(
      `[${event.type}] turno=${event.appointmentId} ${event.message}`,
    );
    return Promise.resolve();
  }
}
