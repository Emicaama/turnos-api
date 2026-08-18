import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { canReschedule, canTransition } from './status-transitions';

describe('status-transitions', () => {
  it('permite confirmar un pendiente', () => {
    expect(
      canTransition(AppointmentStatus.Pendiente, AppointmentStatus.Confirmado),
    ).toBe(true);
  });

  it('no permite completar un pendiente', () => {
    expect(
      canTransition(AppointmentStatus.Pendiente, AppointmentStatus.Completado),
    ).toBe(false);
  });

  it('permite reprogramar solo pendientes o confirmados', () => {
    expect(canReschedule(AppointmentStatus.Pendiente)).toBe(true);
    expect(canReschedule(AppointmentStatus.Cancelado)).toBe(false);
  });
});
