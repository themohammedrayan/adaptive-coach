import { computeTrend, DEFAULT_CONFIG } from '../engine';
import type { IsoDate, Measurement } from '../engine';
import type { BodyMetricRow, MetricType } from '../data-sync';
import type { Point } from './types';

/** Dashboard BRD §A2.1 — raw weigh-ins + EWMA trend line, as two point series. */
export function buildWeightSeries(
  measurements: Measurement[],
  range: { start: IsoDate; end: IsoDate },
  ewmaHalfLifeDays: number = DEFAULT_CONFIG.ewmaHalfLifeDays,
): { raw: Point[]; trend: Point[] } {
  const points = computeTrend(measurements, range, ewmaHalfLifeDays);
  return {
    raw: points
      .filter((p) => p.rawKg !== null)
      .map((p) => ({ date: p.date, value: p.rawKg as number })),
    trend: points.map((p) => ({ date: p.date, value: p.trendKg })),
  };
}

/**
 * Dashboard BRD §A2.4 — local per-day average for a given metric. Gap days
 * are omitted (not interpolated, unlike the weight trend) — components
 * render null/hide the row when a series comes back empty.
 */
export function buildMetricSeries(
  rows: BodyMetricRow[],
  metricType: MetricType,
  range: { start: IsoDate; end: IsoDate },
): Point[] {
  const byDate = new Map<IsoDate, number[]>();
  for (const r of rows) {
    if (r.metricType !== metricType || r.deletedAt !== null) continue;
    if (r.localDate < range.start || r.localDate > range.end) continue;
    const values = byDate.get(r.localDate) ?? [];
    values.push(r.valueSI);
    byDate.set(r.localDate, values);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: values.reduce((s, v) => s + v, 0) / values.length,
    }));
}

export function buildBodyFatSeries(
  rows: BodyMetricRow[],
  range: { start: IsoDate; end: IsoDate },
): Point[] {
  return buildMetricSeries(rows, 'body_fat', range);
}
