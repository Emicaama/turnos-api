import type { AdmissionReason } from '@prisma/client';

const PROTOCOL_TASKS: Record<AdmissionReason, string[]> = {
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

export function buildProtocol(reason: AdmissionReason): string[] {
  return [...PROTOCOL_TASKS[reason]];
}
