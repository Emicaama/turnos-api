import { buildProtocol } from './protocols';

describe('buildProtocol', () => {
  it('cirugía arma el protocolo pre-quirúrgico', () => {
    expect(buildProtocol('cirugia')).toEqual([
      'Verificar ayuno de 8 horas',
      'Colocar vía intravenosa periférica',
      'Signos vitales cada 2 horas',
    ]);
  });

  it('respiratorio pide saturación y aislamiento', () => {
    expect(buildProtocol('respiratorio')).toEqual([
      'Monitoreo continuo de saturación',
      'Aislamiento de contacto y gotas',
    ]);
  });

  it('devuelve una copia que no altera el protocolo base', () => {
    buildProtocol('pediatria').push('extra');
    expect(buildProtocol('pediatria')).toHaveLength(3);
  });
});
