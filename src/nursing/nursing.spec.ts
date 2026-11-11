import { doseNote, isFever, isWithinDoseWindow, vitalNote } from './nursing';

const at = (iso: string) => new Date(iso);

describe('isFever', () => {
  it('trata 39 °C como estable y lo que lo supera como fiebre', () => {
    expect(isFever(39)).toBe(false);
    expect(isFever(39.1)).toBe(true);
  });
});

describe('vitalNote', () => {
  it('anota el control estable', () => {
    expect(vitalNote(false)).toBe('El control de signos salió bien');
  });

  it('anota la temperatura fuera de rango', () => {
    expect(vitalNote(true)).toBe(
      'Signos fuera de rango: temperatura mayor a 39 °C',
    );
  });
});

describe('isWithinDoseWindow', () => {
  it('acepta la toma dentro de los 30 minutos', () => {
    expect(
      isWithinDoseWindow(
        at('2026-10-27T17:00:00.000Z'),
        at('2026-10-27T17:30:00.000Z'),
      ),
    ).toBe(true);
  });

  it('rechaza la toma que se pasa un minuto', () => {
    expect(
      isWithinDoseWindow(
        at('2026-10-27T17:00:00.000Z'),
        at('2026-10-27T17:31:00.000Z'),
      ),
    ).toBe(false);
  });
});

describe('doseNote', () => {
  it('deja la frase de la administración en horario', () => {
    expect(doseNote('Ibuprofeno 400 mg', '1 comprimido')).toBe(
      'Administró Ibuprofeno 400 mg 1 comprimido (en horario)',
    );
  });
});
