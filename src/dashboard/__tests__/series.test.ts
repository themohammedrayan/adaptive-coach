import type { BodyMetricRow } from '../../data-sync';
import type { Measurement } from '../../engine';
import { buildBodyFatSeries, buildWeightSeries } from '../series';

describe('buildWeightSeries — Dashboard BRD §C AT1', () => {
  it('raw contains only actual weigh-in dates; trend covers the full continuous grid', () => {
    const measurements: Measurement[] = [
      { date: '2026-07-01', weightKg: 80, source: 'manual' },
      { date: '2026-07-03', weightKg: 79.5, source: 'manual' },
    ];
    const { raw, trend } = buildWeightSeries(measurements, {
      start: '2026-07-01',
      end: '2026-07-03',
    });
    expect(raw.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-03']);
    expect(trend.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(raw[0].value).toBe(80);
  });
});

function bodyFatRow(localDate: string, valueSI: number): BodyMetricRow {
  return {
    id: `body_fat:${localDate}:${valueSI}`,
    metricType: 'body_fat',
    valueSI,
    source: 'health_connect',
    externalId: `${localDate}-${valueSI}`,
    dataOrigin: null,
    recordedAtUtc: `${localDate}T08:00:00.000Z`,
    localDate,
    ingestedAt: `${localDate}T08:00:00.000Z`,
    deletedAt: null,
    pendingPush: false,
  };
}

describe('buildBodyFatSeries', () => {
  it('averages same-day readings and sorts by date', () => {
    const rows = [bodyFatRow('2026-07-01', 20), bodyFatRow('2026-07-01', 22), bodyFatRow('2026-07-02', 21)];
    const series = buildBodyFatSeries(rows, { start: '2026-07-01', end: '2026-07-02' });
    expect(series).toEqual([
      { date: '2026-07-01', value: 21 },
      { date: '2026-07-02', value: 21 },
    ]);
  });

  it('empty when nothing is syncing (drives BodyFatTrend rendering null)', () => {
    expect(buildBodyFatSeries([], { start: '2026-07-01', end: '2026-07-02' })).toEqual([]);
  });

  it('excludes deleted rows and rows outside the range', () => {
    const rows = [
      { ...bodyFatRow('2026-07-01', 20), deletedAt: '2026-07-02T00:00:00.000Z' },
      bodyFatRow('2026-06-01', 30),
    ];
    expect(buildBodyFatSeries(rows, { start: '2026-07-01', end: '2026-07-02' })).toEqual([]);
  });
});
