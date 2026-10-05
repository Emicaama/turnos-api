import {
  clinicDay,
  clockMinute,
  isHmWithinWindow,
  weekdayAndHm,
} from './time-in-zone';

describe('time-in-zone', () => {
  it('calcula weekday y hora en America/Argentina/Buenos_Aires', () => {
    const date = new Date('2026-08-17T12:00:00.000Z');
    const result = weekdayAndHm(date, 'America/Argentina/Buenos_Aires');
    expect(result.weekday).toBe(1);
    expect(result.hm).toBe('09:00');
  });

  it('acepta un slot dentro de la franja', () => {
    expect(isHmWithinWindow('09:00', '09:30', '09:00', '17:00')).toBe(true);
  });

  it('rechaza un slot que termina después del cierre', () => {
    expect(isHmWithinWindow('16:45', '17:15', '09:00', '17:00')).toBe(false);
  });

  it('arma el día de clínica y el minuto del reloj', () => {
    const date = new Date('2026-08-17T12:15:00.000Z');
    expect(clinicDay(date, 'America/Argentina/Buenos_Aires')).toBe(
      '2026-08-17',
    );
    expect(clockMinute(date, 'America/Argentina/Buenos_Aires')).toBe(15);
  });
});
