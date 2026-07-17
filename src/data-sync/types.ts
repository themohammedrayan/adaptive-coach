import type { IsoDate, Source } from '../engine';

/** Data-Sync BRD §3 — internal metric types, stored in SI units. */
export type MetricType =
  | 'weight'
  | 'body_fat'
  | 'lean_mass'
  | 'bone_mass'
  | 'body_water'
  | 'height'
  | 'bmr';

/** One normalized row (BRD §6). Local id is deterministic: `${source}:${externalId}`. */
export interface BodyMetricRow {
  id: string;
  metricType: MetricType;
  valueSI: number;
  source: Source;
  externalId: string;
  /** Originating package for HC records (e.g. Samsung Health); null for manual. */
  dataOrigin: string | null;
  /** ISO-8601 instant of the reading. */
  recordedAtUtc: string;
  /** recordedAtUtc mapped to the device-local calendar day. */
  localDate: IsoDate;
  ingestedAt: string;
  /** Soft delete (BRD §5) — deleted rows stay for audit and sync. */
  deletedAt: string | null;
  /** Outbox flag: row not yet upserted to Supabase. */
  pendingPush: boolean;
}

/** Unit as delivered by the Health Connect adapter, converted to SI at normalize. */
export type HCUnit = 'kg' | 'lb' | 'percent' | 'fraction' | 'm' | 'cm' | 'kcal_per_day';

/** What the HC adapter emits — already flattened, not yet normalized. */
export interface HCRecord {
  externalId: string;
  dataOrigin: string | null;
  recordedAtUtc: string;
  metricType: MetricType;
  value: number;
  unit: HCUnit;
}

export type SdkAvailability = 'available' | 'unavailable' | 'update_required';

/** 'available' never surfaces: an available SDK proceeds to 'synced' or 'permission_denied'. */
export type HcSyncOutcome = 'synced' | 'unavailable' | 'update_required' | 'permission_denied';

export interface SyncResult {
  /** false when throttled — nothing was attempted. */
  ran: boolean;
  hc: HcSyncOutcome;
  upserted: number;
  deleted: number;
  pushed: number;
  pulled: number;
  /** Push/pull failure (expected offline); local state is unaffected. */
  remoteError: string | null;
}

export interface ManualInput {
  metricType: MetricType;
  valueSI: number;
  recordedAtUtc: string;
}
