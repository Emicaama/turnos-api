import { rangesOverlap } from './overlap';

describe('rangesOverlap', () => {
  const at = (iso: string) => new Date(iso);

  it('detecta solapamiento parcial', () => {
    expect(
      rangesOverlap(
        at('2026-08-18T12:00:00.000Z'),
        at('2026-08-18T12:30:00.000Z'),
        at('2026-08-18T12:15:00.000Z'),
        at('2026-08-18T12:45:00.000Z'),
      ),
    ).toBe(true);
  });

  it('permite turnos contiguos', () => {
    expect(
      rangesOverlap(
        at('2026-08-18T12:00:00.000Z'),
        at('2026-08-18T12:30:00.000Z'),
        at('2026-08-18T12:30:00.000Z'),
        at('2026-08-18T13:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
