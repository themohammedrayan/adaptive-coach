import { addDays, dateRange, diffDays } from './dates';
import type { IsoDate, Measurement, TrendPoint } from './types';

export interface DateRangeSpec {
  start?: IsoDate;
  end: IsoDate;
}

/**
 * Engine BRD §5.1 — EWMA weight trend over a daily grid.
 * Seeded at the first raw weigh-in; gap days hold the trend flat.
 * If several measurements share a date, the last one in input order wins.
 */
export function computeTrend(
  raw: Measurement[],
  range: DateRangeSpec,
  halfLifeDays: number,
): TrendPoint[] {
  if (raw.length === 0) return [];

  const byDate = new Map<IsoDate, number>();
  for (const m of raw) {
    if (diffDays(m.date, range.end) > 0) continue; // ignore future-dated input
    byDate.set(m.date, m.weightKg);
  }
  if (byDate.size === 0) return [];

  const firstDate = [...byDate.keys()].sort()[0];
  const alpha = 1 - Math.pow(0.5, 1 / halfLifeDays);

  const points: TrendPoint[] = [];
  let trend = byDate.get(firstDate)!;
  for (const date of dateRange(firstDate, range.end)) {
    const rawKg = byDate.get(date) ?? null;
    if (date === firstDate) {
      trend = rawKg!;
    } else if (rawKg !== null) {
      trend = trend + alpha * (rawKg - trend);
    }
    points.push({ date, rawKg, trendKg: trend });
  }

  return range.start ? points.filter((p) => diffDays(p.date, range.start!) >= 0) : points;
}

/** Trend value on a given date (or the nearest earlier point); null before the series starts. */
export function trendAt(points: TrendPoint[], date: IsoDate): number | null {
  let value: number | null = null;
  for (const p of points) {
    if (diffDays(p.date, date) > 0) break;
    value = p.trendKg;
  }
  return value;
}

/**
 * kg change per week: trend[today] − trend[today−7].
 * Pro-rated when the series is younger than 7 days; null when it can't be computed.
 */
export function weeklyRate(points: TrendPoint[], today: IsoDate): number | null {
  if (points.length === 0) return null;
  const current = trendAt(points, today);
  if (current === null) return null;
  const weekAgo = trendAt(points, addDays(today, -7));
  if (weekAgo !== null) return current - weekAgo;
  const first = points[0];
  const span = diffDays(today, first.date);
  if (span <= 0) return 0;
  return ((current - first.trendKg) / span) * 7;
}
