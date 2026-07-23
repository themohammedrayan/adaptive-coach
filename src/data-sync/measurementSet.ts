import { addManualMetric, type IdGenerator } from './manual';
import type { InstantToLocalDate } from './normalize';
import type { BodyMetricsStore } from './store';
import type { BodyMetricRow, MetricType } from './types';

/** One "Log Measurements" save — any subset of fields, one shared timestamp. */
export interface MeasurementSetInput {
  recordedAtUtc: string;
  values: Partial<Record<MetricType, number>>;
}

/**
 * Logs a full measurement-set as individual body_metrics rows sharing one
 * recordedAtUtc/localDate. Thin wrapper over addManualMetric — no new
 * dedup/sync logic, since every row still keys on (source, externalId).
 */
export async function addManualMeasurementSet(
  store: BodyMetricsStore,
  input: MeasurementSetInput,
  toLocalDate: InstantToLocalDate,
  nowUtc: string,
  genId?: IdGenerator,
): Promise<BodyMetricRow[]> {
  const rows: BodyMetricRow[] = [];
  for (const [metricType, valueSI] of Object.entries(input.values) as [MetricType, number | undefined][]) {
    if (valueSI === undefined) continue;
    rows.push(
      await addManualMetric(
        store,
        { metricType, valueSI, recordedAtUtc: input.recordedAtUtc },
        toLocalDate,
        nowUtc,
        genId,
      ),
    );
  }
  return rows;
}
