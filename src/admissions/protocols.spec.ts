import { DEFAULT_PROTOCOLS, normalizeReason } from './protocols';

describe('DEFAULT_PROTOCOLS', () => {
  it('cirugía arma el protocolo pre-quirúrgico', () => {
    expect(DEFAULT_PROTOCOLS.cirugia).toEqual([
      'Verificar ayuno de 8 horas',
      'Colocar vía intravenosa periférica',
      'Signos vitales cada 2 horas',
    ]);
  });

  it('respiratorio pide saturación y aislamiento', () => {
    expect(DEFAULT_PROTOCOLS.respiratorio).toEqual([
      'Monitoreo continuo de saturación',
      'Aislamiento de contacto y gotas',
    ]);
  });
});

describe('normalizeReason', () => {
  it('compara motivos sin espacios ni mayúsculas', () => {
    expect(normalizeReason('  Traumatismo ')).toBe('traumatismo');
  });

  it('deja pasar lo que no es texto para que lo rechace la validación', () => {
    expect(normalizeReason(3)).toBe(3);
  });
});
