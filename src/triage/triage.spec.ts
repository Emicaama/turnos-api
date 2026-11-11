import { byRiskThenArrival, isVitalRisk } from './triage';

const at = (iso: string) => new Date(iso);

describe('byRiskThenArrival', () => {
  it('pone el rojo delante de un riesgo menor que llegó antes', () => {
    const yellow = {
      level: 'amarillo' as const,
      createdAt: at('2026-10-27T10:00:00.000Z'),
    };
    const red = {
      level: 'rojo' as const,
      createdAt: at('2026-10-27T10:05:00.000Z'),
    };
    expect(
      [yellow, red].sort(byRiskThenArrival).map((row) => row.level),
    ).toEqual(['rojo', 'amarillo']);
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
    expect([later, earlier].sort(byRiskThenArrival)).toEqual([earlier, later]);
  });
});

describe('isVitalRisk', () => {
  it('solo el código rojo es riesgo vital', () => {
    expect(isVitalRisk('rojo')).toBe(true);
    expect(isVitalRisk('amarillo')).toBe(false);
    expect(isVitalRisk('verde')).toBe(false);
  });
});
