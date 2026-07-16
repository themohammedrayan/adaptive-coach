import type { DailyTotals } from '../food-log';
import type { DayStatus } from './types';

export interface AdherenceSummary {
  days: DayStatus[];
  avgIntake: number;
  avgTarget: number;
}

/**
 * Dashboard BRD §A2.3 — last 14 days: which were logged, average intake vs
 * average target. avgIntake averages logged days only (mirrors
 * engine/tdee.ts's own "never impute zeros" convention). avgTarget holds
 * the single current target flat across the window — there's no
 * historical per-day target in v1, and the target changes at most once
 * per recomputeIntervalDays (7) anyway.
 *
 * Takes the already-fetched last14 array (shared with the Engine's
 * DayLog[] window in refreshSnapshot.ts) rather than a store, keeping
 * this a pure, trivially-testable function.
 */
export function buildAdherenceSummary(
  last14: DailyTotals[],
  targetKcal: number | null,
): AdherenceSummary {
  const days: DayStatus[] = last14.map((t) => ({ date: t.localDate, logged: t.logged }));
  const loggedTotals = last14.filter((t) => t.logged);
  const avgIntake =
    loggedTotals.length > 0
      ? loggedTotals.reduce((s, t) => s + t.kcal, 0) / loggedTotals.length
      : 0;
  return { days, avgIntake, avgTarget: targetKcal ?? 0 };
}
