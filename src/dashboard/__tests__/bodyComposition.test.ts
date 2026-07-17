import type { BodyMetricRow, MetricType } from '../../data-sync';
import { buildBodyCompositionSummary } from '../bodyComposition';

function row(metricType: MetricType, localDate: string, valueSI: number): BodyMetricRow {
  return {
    id: `${metricType}:${localDate}:${valueSI}`,
    metricType,
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

describe('buildBodyCompositionSummary', () => {
  const range = { start: '2026-07-01', end: '2026-07-03' };

  it('returns null latestValue/deltaSincePrevious for a metric with no rows', () => {
    const summary = buildBodyCompositionSummary({}, range);
    expect(summary).toHaveLength(4);
    for (const entry of summary) {
      expect(entry.latestValue).toBeNull();
      expect(entry.latestDate).toBeNull();
      expect(entry.deltaSincePrevious).toBeNull();
    }
  });

  it('surfaces the latest value with a null delta when only one reading exists', () => {
    const summary = buildBodyCompositionSummary(
      { weight: [row('weight', '2026-07-01', 99)] },
      range,
    );
    const weight = summary.find((e) => e.metricType === 'weight')!;
    expect(weight.latestValue).toBe(99);
    expect(weight.latestDate).toBe('2026-07-01');
    expect(weight.deltaSincePrevious).toBeNull();
  });

  it('computes delta since the previous daily-averaged reading', () => {
    const summary = buildBodyCompositionSummary(
      {
        lean_mass: [row('lean_mass', '2026-07-01', 35.0), row('lean_mass', '2026-07-02', 35.3)],
      },
      range,
    );
    const leanMass = summary.find((e) => e.metricType === 'lean_mass')!;
    expect(leanMass.latestValue).toBe(35.3);
    expect(leanMass.deltaSincePrevious).toBeCloseTo(0.3);
  });

  it('labels lean_mass as "Lean mass", not "Skeletal muscle"', () => {
    const summary = buildBodyCompositionSummary({}, range);
    expect(summary.find((e) => e.metricType === 'lean_mass')?.label).toBe('Lean mass');
  });
});
