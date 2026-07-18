import type { IsoDate } from '../engine';
import type { BodyMetricRow, MetricType } from './types';

/** KV keys for device-local sync state (never synced to the server). */
export const KV = {
  lastSyncAt: 'lastSyncAt',
  hcChangesToken: 'hcChangesToken',
  lastPulledAt: 'lastPulledAt',
  /** JSON array of MetricType — the Health Connect permissions actually granted
   * as of the last sync, so the dashboard can tell "denied" apart from "no data". */
  grantedTypes: 'grantedTypes',
} as const;

/**
 * Local persistence contract. Implementations: SQLite (device), in-memory (tests).
 * Upsert key is (source, externalId) — re-ingesting is always idempotent.
 */
export interface BodyMetricsStore {
  /** Insert or replace by (source, externalId). Preserves the original ingestedAt on update. */
  upsert(row: BodyMetricRow): Promise<void>;
  get(source: BodyMetricRow['source'], externalId: string): Promise<BodyMetricRow | null>;
  /** Marks deleted + pending push. Returns false when no such row exists. */
  softDelete(
    source: BodyMetricRow['source'],
    externalId: string,
    deletedAtUtc: string,
  ): Promise<boolean>;
  /** Non-deleted rows of a type within a localDate range, oldest first. */
  listByType(
    metricType: MetricType,
    range: { start: IsoDate; end: IsoDate },
  ): Promise<BodyMetricRow[]>;
  listPendingPush(): Promise<BodyMetricRow[]>;
  markPushed(ids: string[]): Promise<void>;
  getKV(key: string): Promise<string | null>;
  setKV(key: string, value: string): Promise<void>;
}
