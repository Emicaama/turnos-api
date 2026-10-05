import { isEntreturnoStart } from './entreturno';

describe('isEntreturnoStart', () => {
  it('acepta los :15 y los :45', () => {
    expect(isEntreturnoStart(15)).toBe(true);
    expect(isEntreturnoStart(45)).toBe(true);
  });

  it('rechaza el resto de los minutos', () => {
    expect(isEntreturnoStart(0)).toBe(false);
    expect(isEntreturnoStart(30)).toBe(false);
  });
});
