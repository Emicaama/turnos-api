import type { Coverage, Payer } from '@prisma/client';

export type ChargeSplit = { payer: Payer; amount: number };

type SplitRule = (price: number, copay: number) => ChargeSplit[];

const SPLIT_BY_COVERAGE: Record<Coverage, SplitRule> = {
  publica: (price) => [
    { payer: 'paciente', amount: 0 },
    { payer: 'estado', amount: price },
  ],
  prepaga: (price, copay) => {
    const patientPays = Math.min(copay, price);
    return [
      { payer: 'paciente', amount: patientPays },
      { payer: 'prepaga', amount: price - patientPays },
    ];
  },
  particular: (price) => [{ payer: 'paciente', amount: price }],
};

export function splitByCoverage(
  coverage: Coverage,
  price: number,
  copay: number,
): ChargeSplit[] {
  return SPLIT_BY_COVERAGE[coverage](price, copay);
}
