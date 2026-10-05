import { Appointment, WaitlistEntry } from '@prisma/client';

export type BookingResult =
  | {
      result: 'programado';
      appointment: Appointment;
      acortado?: Appointment;
    }
  | { result: 'lista_de_espera'; waitlist: WaitlistEntry };

export type Range = {
  startAt: Date;
  endAt: Date;
};
