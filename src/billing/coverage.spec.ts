import { patientShare, splitByCoverage } from './coverage';

describe('patientShare', () => {
  it('suma solo lo que paga el paciente', () => {
    expect(patientShare(splitByCoverage('prepaga', 15000, 3000))).toBe(3000);
    expect(patientShare(splitByCoverage('publica', 15000, 0))).toBe(0);
    expect(patientShare(splitByCoverage('particular', 15000, 0))).toBe(15000);
  });
});

describe('splitByCoverage', () => {
  it('pública: el paciente paga 0 y el Estado subsidia todo', () => {
    expect(splitByCoverage('publica', 15000, 0)).toEqual([
      { payer: 'paciente', amount: 0 },
      { payer: 'estado', amount: 15000 },
    ]);
  });

  it('prepaga: el paciente paga el copago y el resto va a la prepaga', () => {
    expect(splitByCoverage('prepaga', 15000, 3000)).toEqual([
      { payer: 'paciente', amount: 3000 },
      { payer: 'prepaga', amount: 12000 },
    ]);
  });

  it('prepaga: el copago nunca supera el precio', () => {
    expect(splitByCoverage('prepaga', 2000, 3000)).toEqual([
      { payer: 'paciente', amount: 2000 },
      { payer: 'prepaga', amount: 0 },
    ]);
  });

  it('particular: el paciente paga el 100 %', () => {
    expect(splitByCoverage('particular', 15000, 0)).toEqual([
      { payer: 'paciente', amount: 15000 },
    ]);
  });
});
