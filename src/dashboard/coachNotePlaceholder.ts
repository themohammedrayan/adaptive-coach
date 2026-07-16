import type { EngineResult, IsoDate, Reason } from '../engine';
import type { CoachNote } from './types';

function describeReason(r: Reason): string {
  switch (r.code) {
    case 'TARGET_CHANGED':
      return `Target moved ${r.from} → ${r.to} kcal (${r.deltaKcal > 0 ? '+' : ''}${r.deltaKcal}).`;
    case 'TREND_STALLED':
      return 'Weight trend stalled over the last window.';
    case 'BOUND_HIT':
      return `Hit the ${r.bound} safety limit.`;
    case 'INSUFFICIENT_DATA':
      return `Not enough data (${r.loggedDays} logged days, ${r.weighIns} weigh-ins) — holding last target.`;
    case 'COLD_START':
      return `Still cold-starting (${Math.round(r.seedShare * 100)}% formula-seeded).`;
    case 'MACRO_RECONCILED':
      return r.note;
  }
}

/**
 * Dashboard BRD — placeholder for the real Coaching module (built last,
 * not built yet). Redisplays the Engine's own machine-readable
 * EngineResult.reasons verbatim — no new business logic, just narration
 * of what the Engine already decided. Delete this file wholesale, along
 * with the provisional CoachNote type, once Coaching ships.
 */
export function buildPlaceholderCoachNote(result: EngineResult, today: IsoDate): CoachNote {
  const headline =
    result.reasons.length > 0
      ? describeReason(result.reasons[0])
      : `Target held at ${result.targetKcal} kcal.`;
  return { id: `note-${today}`, weekOf: today, headline, reasons: result.reasons };
}
