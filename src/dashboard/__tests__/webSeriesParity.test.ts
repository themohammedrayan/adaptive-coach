import type { Measurement } from '../../engine';
import { buildWeightSeries } from '../series';
import type { WeightTrendChartProps } from '../components/types';

/**
 * Dashboard BRD §C AT8 — data-contract half. Both platform variants
 * (WeightTrendChart.tsx / .web.tsx) import and are typed against the same
 * WeightTrendChartProps from components/types.ts, and `tsc --noEmit`
 * already proves each file's implementation satisfies it — a compile
 * error in either variant fails the build, not silently drifts. This test
 * proves buildWeightSeries()'s real output satisfies that shared contract
 * (the data half of "renders the same series").
 *
 * This test deliberately does NOT import the component files themselves:
 * both chart libraries (react-native-gifted-charts, recharts) pull in
 * transitive ESM dependencies several layers deep (gifted-charts-core,
 * @reduxjs/toolkit/immer) that would require an ever-growing Jest
 * transformIgnorePatterns allowlist unrelated to this project's own code.
 * The remaining half of AT8 (do the two variants render identically) has
 * no automatable check in this repo (no visual-regression tool) — do a
 * manual `npx expo export -p web` spot-check as part of review.
 */
describe('WeightTrendChart props — Dashboard BRD §C AT8 (data-contract half)', () => {
  it('buildWeightSeries() output satisfies the shared WeightTrendChartProps contract', () => {
    const measurements: Measurement[] = [
      { date: '2026-07-01', weightKg: 80, source: 'manual' },
      { date: '2026-07-05', weightKg: 79, source: 'manual' },
    ];
    const { raw, trend } = buildWeightSeries(measurements, { start: '2026-07-01', end: '2026-07-05' });

    const props: WeightTrendChartProps = {
      raw,
      trend,
      goalWeight: 75,
      projectedFinish: '2026-09-01',
      range: '30',
    };

    // Both platform variants would receive this exact same object.
    expect(props.raw.length).toBeGreaterThan(0);
    expect(props.trend.length).toBe(5); // continuous grid, 07-01..07-05
  });
});
