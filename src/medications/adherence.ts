import type { IsoDate } from '../engine';
import { expectedDosesForDate } from './schedule';
import type { Medication, MedicationDose } from './types';

export interface DayAdherence {
  date: IsoDate;
  expected: number;
  taken: number;
  skipped: number;
  /** taken/expected; null when nothing was due that day. */
  pct: number | null;
}

/** Per-day adherence over `window` (any order in, same order out) — mirrors src/dashboard/adherence.ts's shape. */
export function buildMedicationAdherence(
  medications: Medication[],
  doses: MedicationDose[],
  window: IsoDate[],
): DayAdherence[] {
  return window.map((date) => {
    const expected = expectedDosesForDate(medications, doses, date);
    const taken = expected.filter((d) => d.status === 'taken').length;
    const skipped = expected.filter((d) => d.status === 'skipped').length;
    return {
      date,
      expected: expected.length,
      taken,
      skipped,
      pct: expected.length > 0 ? taken / expected.length : null,
    };
  });
}

/**
 * Consecutive days, counting back from the end of `days`, that were 100%
 * taken. A day with nothing due doesn't break the streak; the first day
 * with doses due that wasn't fully taken stops the count. `days` must be in
 * chronological order (oldest first) — same order buildMedicationAdherence returns.
 */
export function currentStreak(days: DayAdherence[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (day.expected === 0) continue;
    if (day.pct === 1) {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}
