const FEVER_CELSIUS = 39;
const DOSE_WINDOW_MS = 30 * 60_000;

export function isFever(temperatureC: number): boolean {
  return temperatureC > FEVER_CELSIUS;
}

export function vitalNote(fever: boolean): string {
  return fever
    ? 'Signos fuera de rango: temperatura mayor a 39 °C'
    : 'El control de signos salió bien';
}

export function isWithinDoseWindow(scheduledAt: Date, givenAt: Date): boolean {
  return Math.abs(givenAt.getTime() - scheduledAt.getTime()) <= DOSE_WINDOW_MS;
}

export function doseNote(drug: string, dose: string): string {
  return `Administró ${drug} ${dose} (en horario)`;
}
