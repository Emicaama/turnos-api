export type SlotDecision = 'programado' | 'lista_de_espera' | 'recien_ocupado';

export function decideSlot(
  seenFree: boolean,
  freeInsideLock: boolean,
): SlotDecision {
  if (freeInsideLock) {
    return 'programado';
  }
  if (seenFree) {
    return 'recien_ocupado';
  }
  return 'lista_de_espera';
}
