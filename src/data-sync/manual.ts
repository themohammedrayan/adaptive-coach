import type { InstantToLocalDate } from './normalize';
import type { BodyMetricsStore } from './store';
import type { BodyMetricRow, ManualInput } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Data-Sync BRD §9 — manual entry. Always available, even with Health Connect
 * connected; a manual weight overrides the synced one for its day (§8 rule 1).
 */
export async function addManualMetric(
  store: BodyMetricsStore,
  input: ManualInput,
  toLocalDate: InstantToLocalDate,
  nowUtc: string,
  genId: IdGenerator = defaultGenId,
): Promise<BodyMetricRow> {
  const externalId = genId();
  const row: BodyMetricRow = {
    id: `manual:${externalId}`,
    metricType: input.metricType,
    valueSI: input.valueSI,
    source: 'manual',
    externalId,
    dataOrigin: null,
    recordedAtUtc: input.recordedAtUtc,
    localDate: toLocalDate(input.recordedAtUtc),
    ingestedAt: nowUtc,
    deletedAt: null,
    pendingPush: true,
  };
  await store.upsert(row);
  return row;
}

export async function updateManualMetric(
  store: BodyMetricsStore,
  externalId: string,
  valueSI: number,
  nowUtc: string,
): Promise<BodyMetricRow | null> {
  const row = await store.get('manual', externalId);
  if (row === null || row.deletedAt !== null) return null;
  const updated: BodyMetricRow = { ...row, valueSI, ingestedAt: nowUtc, pendingPush: true };
  await store.upsert(updated);
  return updated;
}

export async function deleteManualMetric(
  store: BodyMetricsStore,
  externalId: string,
  nowUtc: string,
): Promise<boolean> {
  return store.softDelete('manual', externalId, nowUtc);
}
