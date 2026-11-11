import { splitByCoverage } from './coverage';

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
