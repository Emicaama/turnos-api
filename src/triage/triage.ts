export const TRIAGE_LEVELS = ['rojo', 'amarillo', 'verde'] as const;

export type TriageLevel = (typeof TRIAGE_LEVELS)[number];

const RANK: Record<TriageLevel, number> = {
  rojo: 0,
  amarillo: 1,
  verde: 2,
};

export function compareTriage(
  a: { level: TriageLevel; createdAt: Date },
  b: { level: TriageLevel; createdAt: Date },
): number {
  const byRisk = RANK[a.level] - RANK[b.level];
  if (byRisk !== 0) {
    return byRisk;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function triageAlert(level: TriageLevel): string | null {
  if (level !== 'rojo') {
    return null;
  }
  return 'Riesgo vital (código rojo). Avisar a los médicos de guardia.';
}
