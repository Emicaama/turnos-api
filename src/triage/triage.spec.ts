import { compareTriage, triageAlert } from './triage';

const at = (iso: string) => new Date(iso);

describe('compareTriage', () => {
  it('pone el rojo delante de un riesgo menor que llegó antes', () => {
    const yellow = {
      level: 'amarillo' as const,
      createdAt: at('2026-10-27T10:00:00.000Z'),
    };
    const red = {
      level: 'rojo' as const,
      createdAt: at('2026-10-27T10:05:00.000Z'),
    };
    expect([yellow, red].sort(compareTriage).map((row) => row.level)).toEqual([
      'rojo',
      'amarillo',
    ]);
  });

  it('a igual nivel conserva el orden de llegada', () => {
    const later = {
      level: 'verde' as const,
      createdAt: at('2026-10-27T11:00:00.000Z'),
    };
    const earlier = {
      level: 'verde' as const,
      createdAt: at('2026-10-27T10:00:00.000Z'),
    };
    expect([later, earlier].sort(compareTriage)).toEqual([earlier, later]);
  });
});

describe('triageAlert', () => {
  it('avisa a la guardia solo en código rojo', () => {
    expect(triageAlert('rojo')).toBe(
      'Riesgo vital (código rojo). Avisar a los médicos de guardia.',
    );
    expect(triageAlert('amarillo')).toBeNull();
    expect(triageAlert('verde')).toBeNull();
  });
});
