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
