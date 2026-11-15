import { bedStatusError, canChangeBedStatus } from './bed-status';

describe('canChangeBedStatus', () => {
  it('maestranza devuelve al mapa una cama en limpieza', () => {
    expect(canChangeBedStatus('en_limpieza', 'disponible')).toBe(true);
  });

  it('una cama en limpieza no se asigna ni pasa a ocupada', () => {
    expect(canChangeBedStatus('en_limpieza', 'ocupada')).toBe(false);
  });

  it('una cama ocupada no se libera a mano', () => {
    expect(canChangeBedStatus('ocupada', 'disponible')).toBe(false);
    expect(bedStatusError('ocupada', 'disponible')).toBe(
      'Una cama ocupada solo se libera con el alta del paciente',
    );
  });

  it('una cama disponible se bloquea por mantenimiento y vuelve', () => {
    expect(canChangeBedStatus('disponible', 'bloqueada')).toBe(true);
    expect(canChangeBedStatus('bloqueada', 'disponible')).toBe(true);
  });
});
