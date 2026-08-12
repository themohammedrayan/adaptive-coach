import type { NetWorthPoint } from './netWorth';

export interface WealthProjectionPoint {
  monthsAhead: number;
  projectedNetWorthMinor: number;
}

/**
 * Naive linear extrapolation from the average of the trailing month-over-month
 * deltas in `series` — an estimate, not advice, and never fed anything but a
 * monthly-cadence series (the projection is independent of the Reports
 * screen's day/month/year granularity toggle).
 */
export function projectNetWorth(series: NetWorthPoint[], monthsAhead: number[]): WealthProjectionPoint[] {
  const last = series[series.length - 1]?.netWorthMinor ?? 0;
  if (series.length < 2) {
    return monthsAhead.map((m) => ({ monthsAhead: m, projectedNetWorthMinor: last }));
  }
  const deltas: number[] = [];
  for (let i = 1; i < series.length; i++) deltas.push(series[i].netWorthMinor - series[i - 1].netWorthMinor);
  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  return monthsAhead.map((m) => ({ monthsAhead: m, projectedNetWorthMinor: Math.round(last + avgDelta * m) }));
}

/**
 * Index of the first point where a series crosses from negative into
 * non-negative territory — used to mark "when net worth turns positive" on
 * the projected chart. Null if it never crosses (already non-negative
 * throughout, or never recovers).
 */
export function zeroCrossingIndex(values: number[]): number | null {
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] < 0 && values[i] >= 0) return i;
  }
  return null;
}
