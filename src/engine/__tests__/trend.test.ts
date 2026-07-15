import { addDays, dateRange, diffDays } from '../dates';
import { computeTrend, trendAt, weeklyRate } from '../trend';
import type { Measurement } from '../types';

const m = (date: string, weightKg: number): Measurement => ({
  date,
  weightKg,
  source: 'manual',
});

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
  });

  it('diffs whole days', () => {
    expect(diffDays('2026-07-15', '2026-07-01')).toBe(14);
    expect(diffDays('2026-07-01', '2026-07-15')).toBe(-14);
  });

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
    expect(dateRange('2026-07-03', '2026-07-01')).toEqual([]);
  });
});

describe('computeTrend (BRD §5.1)', () => {
  const alpha = 1 - Math.pow(0.5, 1 / 10);

  it('seeds at the first weigh-in and applies EWMA', () => {
    const points = computeTrend(
      [m('2026-07-01', 100), m('2026-07-02', 99)],
      { end: '2026-07-02' },
      10,
    );
    expect(points[0].trendKg).toBe(100);
    expect(points[1].trendKg).toBeCloseTo(100 + alpha * (99 - 100), 6);
  });

  it('holds flat on gap days and resumes on the next weigh-in', () => {
    const points = computeTrend(
      [m('2026-07-01', 100), m('2026-07-02', 99), m('2026-07-04', 98)],
      { end: '2026-07-04' },
      10,
    );
    const t2 = 100 + alpha * (99 - 100);
    expect(points[2].rawKg).toBeNull();
    expect(points[2].trendKg).toBeCloseTo(t2, 6); // gap: hold flat
    expect(points[3].trendKg).toBeCloseTo(t2 + alpha * (98 - t2), 6);
  });

  it('extends the grid to range end past the last weigh-in', () => {
    const points = computeTrend([m('2026-07-01', 100)], { end: '2026-07-05' }, 10);
    expect(points).toHaveLength(5);
    expect(points[4].trendKg).toBe(100);
  });

  it('ignores future-dated measurements and handles empty input', () => {
    expect(computeTrend([], { end: '2026-07-05' }, 10)).toEqual([]);
    expect(computeTrend([m('2026-07-09', 90)], { end: '2026-07-05' }, 10)).toEqual([]);
  });
});

describe('weeklyRate', () => {
  it('uses trend[today] − trend[today−7] when available', () => {
    const raw = Array.from({ length: 15 }, (_, i) =>
      m(addDays('2026-07-01', i), 100 - i * 0.1),
    );
    const points = computeTrend(raw, { end: '2026-07-15' }, 10);
    const expected =
      trendAt(points, '2026-07-15')! - trendAt(points, '2026-07-08')!;
    expect(weeklyRate(points, '2026-07-15')).toBeCloseTo(expected, 9);
    expect(expected).toBeLessThan(0);
  });

  it('pro-rates when the series is younger than 7 days', () => {
    const points = computeTrend(
      [m('2026-07-01', 100), m('2026-07-03', 99)],
      { end: '2026-07-03' },
      10,
    );
    const first = points[0].trendKg;
    const last = points[2].trendKg;
    expect(weeklyRate(points, '2026-07-03')).toBeCloseTo(((last - first) / 2) * 7, 9);
  });
});
