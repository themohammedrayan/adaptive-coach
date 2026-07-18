import type { IsoDate } from '../engine';
import type { BodyMetricRow, MetricType } from '../data-sync';
import { buildMetricSeries } from './series';

export type BodyCompositionMetric = 'weight' | 'lean_mass' | 'bone_mass' | 'body_water';

export interface BodyCompositionEntry {
  metricType: BodyCompositionMetric;
  label: string;
  unit: 'kg';
  latestValue: number | null;
  latestDate: IsoDate | null;
  /** latestValue minus the prior daily-averaged reading in range; null with fewer than 2 readings. */
  deltaSincePrevious: number | null;
  /** Health Connect permission state for this metric as of the last sync — null
   * when unknown (e.g. never synced, or on web where there's no Health Connect).
   * Lets the empty state say "permission not granted" vs "no connected source". */
  permissionGranted: boolean | null;
}

const METRICS: { metricType: BodyCompositionMetric; label: string }[] = [
  { metricType: 'weight', label: 'Weight' },
  { metricType: 'lean_mass', label: 'Lean mass' },
  { metricType: 'bone_mass', label: 'Bone mass' },
  { metricType: 'body_water', label: 'Body water' },
];

/**
 * Dashboard follow-up — Samsung-style body-composition summary, built from
 * the same per-day-average convention as buildMetricSeries (gap days
 * omitted, not interpolated). "Skeletal muscle" is intentionally not
 * included: Health Connect has no such record type, and `lean_mass` (fat-free
 * mass) is a different, broader measurement — labeling it "Lean mass" avoids
 * implying a reading the app doesn't actually have.
 */
export function buildBodyCompositionSummary(
  rowsByMetric: Partial<Record<BodyCompositionMetric, BodyMetricRow[]>>,
  range: { start: IsoDate; end: IsoDate },
  grantedTypes: MetricType[] | null = null,
): BodyCompositionEntry[] {
  return METRICS.map(({ metricType, label }) => {
    const series = buildMetricSeries(rowsByMetric[metricType] ?? [], metricType as MetricType, range);
    const last = series[series.length - 1] ?? null;
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    return {
      metricType,
      label,
      unit: 'kg' as const,
      latestValue: last?.value ?? null,
      latestDate: last?.date ?? null,
      deltaSincePrevious: last && prev ? last.value - prev.value : null,
      permissionGranted: grantedTypes === null ? null : grantedTypes.includes(metricType as MetricType),
    };
  });
}
