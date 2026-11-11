import { bedStatusError, canChangeBedStatus } from './bed-status';

describe('canChangeBedStatus', () => {
  it('maestranza devuelve al mapa una cama en limpieza', () => {
    expect(canChangeBedStatus('en_limpieza', 'libre')).toBe(true);
  });

  it('una cama en limpieza no se asigna ni pasa a ocupada', () => {
    expect(canChangeBedStatus('en_limpieza', 'ocupada')).toBe(false);
  });

  it('una cama ocupada no se libera a mano', () => {
    expect(canChangeBedStatus('ocupada', 'libre')).toBe(false);
    expect(bedStatusError('ocupada', 'libre')).toBe(
      'Una cama ocupada solo se libera con el alta del paciente',
    );
  });

  it('una cama libre se bloquea por mantenimiento y vuelve', () => {
    expect(canChangeBedStatus('libre', 'bloqueada')).toBe(true);
    expect(canChangeBedStatus('bloqueada', 'libre')).toBe(true);
  });
});
