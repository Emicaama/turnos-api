import { AppointmentStatus } from '../../common/enums/appointment-status.enum';
import { canReschedule, canTransition } from './status-transitions';

describe('status-transitions', () => {
  it('pasa de programado a sala de espera', () => {
    expect(
      canTransition(
        AppointmentStatus.Programado,
        AppointmentStatus.EnSalaDeEspera,
      ),
    ).toBe(true);
  });

  it('no atiende un programado sin pasar por sala de espera', () => {
    expect(
      canTransition(AppointmentStatus.Programado, AppointmentStatus.Atendido),
    ).toBe(false);
  });

  it('no deja avanzar un cancelado', () => {
    expect(
      canTransition(AppointmentStatus.Cancelado, AppointmentStatus.Atendido),
    ).toBe(false);
  });

  it('permite reprogramar solo un programado', () => {
    expect(canReschedule(AppointmentStatus.Programado)).toBe(true);
    expect(canReschedule(AppointmentStatus.EnSalaDeEspera)).toBe(false);
    expect(canReschedule(AppointmentStatus.Cancelado)).toBe(false);
  });
});
