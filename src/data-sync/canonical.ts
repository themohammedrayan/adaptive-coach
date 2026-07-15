import { dateRange } from '../engine';
import type { IsoDate, Measurement } from '../engine';
import type { BodyMetricRow } from './types';

export type DailyPick = 'earliest' | 'latest' | 'average';

/**
 * Data-Sync BRD §8 — one weight per calendar day for the Engine:
 * 1. a manual weight wins (deliberate override; latest manual if several)
 * 2. else Health Connect, earliest of the day by default (fasted-morning consistency)
 * 3. else no value — the Engine's EWMA holds flat on gaps.
 */
export function canonicalDailyWeight(
  rows: BodyMetricRow[],
  localDate: IsoDate,
  pick: DailyPick = 'earliest',
): { weightKg: number; source: Measurement['source'] } | null {
  const day = rows.filter(
    (r) => r.metricType === 'weight' && r.localDate === localDate && r.deletedAt === null,
  );
  if (day.length === 0) return null;

  const manual = day.filter((r) => r.source === 'manual');
  if (manual.length > 0) {
    const latest = manual.reduce((a, b) =>
      Date.parse(b.recordedAtUtc) >= Date.parse(a.recordedAtUtc) ? b : a,
    );
    return { weightKg: latest.valueSI, source: 'manual' };
  }

  const hc = day.filter((r) => r.source === 'health_connect');
  if (hc.length === 0) return null;
  if (pick === 'average') {
    return {
      weightKg: hc.reduce((s, r) => s + r.valueSI, 0) / hc.length,
      source: 'health_connect',
    };
  }
  const chosen = hc.reduce((a, b) => {
    const later = Date.parse(b.recordedAtUtc) >= Date.parse(a.recordedAtUtc);
    return (pick === 'latest') === later ? b : a;
  });
  return { weightKg: chosen.valueSI, source: 'health_connect' };
}

/** The engine's input series over a date range (gap days omitted). */
export function buildMeasurementSeries(
  rows: BodyMetricRow[],
  range: { start: IsoDate; end: IsoDate },
  pick: DailyPick = 'earliest',
): Measurement[] {
  const out: Measurement[] = [];
  for (const date of dateRange(range.start, range.end)) {
    const c = canonicalDailyWeight(rows, date, pick);
    if (c !== null) out.push({ date, weightKg: c.weightKg, source: c.source });
  }
  return out;
}
