export const DEFAULT_PROTOCOLS: Record<string, string[]> = {
  cirugia: [
    'Verificar ayuno de 8 horas',
    'Colocar vía intravenosa periférica',
    'Signos vitales cada 2 horas',
  ],
  respiratorio: [
    'Monitoreo continuo de saturación',
    'Aislamiento de contacto y gotas',
  ],
  pediatria: [
    'Signos vitales cada 4 horas',
    'Control de peso y balance hídrico',
    'Acompañante permanente',
  ],
};

export function normalizeReason(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
