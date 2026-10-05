import { decideSlot } from './slot-decision';

describe('decideSlot', () => {
  it('programa si el horario sigue libre dentro del bloqueo', () => {
    expect(decideSlot(true, true)).toBe('programado');
  });

  it('rechaza la reserva que llegó en el mismo instante', () => {
    expect(decideSlot(true, false)).toBe('recien_ocupado');
  });

  it('manda a la lista de espera si el horario ya estaba ocupado', () => {
    expect(decideSlot(false, false)).toBe('lista_de_espera');
  });
});
