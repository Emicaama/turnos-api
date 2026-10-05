export function isEntreturnoStart(minute: number): boolean {
  return minute === 15 || minute === 45;
}
