import type { TriageLevel } from '@prisma/client';

const RISK_ORDER: Record<TriageLevel, number> = {
  rojo: 0,
  amarillo: 1,
  verde: 2,
};

type QueuedPatient = { level: TriageLevel; createdAt: Date };

export function byRiskThenArrival(a: QueuedPatient, b: QueuedPatient): number {
  return (
    RISK_ORDER[a.level] - RISK_ORDER[b.level] ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

export function isVitalRisk(level: TriageLevel): boolean {
  return level === 'rojo';
}
