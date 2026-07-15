import { normalizeRecord, type InstantToLocalDate } from './normalize';
import { KV, type BodyMetricsStore } from './store';
import type { HCRecord, MetricType, SdkAvailability, SyncResult } from './types';
import type { BodyMetricRow } from './types';

/** Thin seam over react-native-health-connect; faked in tests, stubbed on web. */
export interface HealthConnectAdapter {
  getSdkStatus(): Promise<SdkAvailability>;
  /** Requests any missing read permissions; returns what is actually granted. */
  ensurePermissions(types: MetricType[]): Promise<MetricType[]>;
  /** Incremental read via changes token, or time-range read when no token. */
  read(opts: {
    changesToken: string | null;
    sinceIso: string;
    untilIso: string;
  }): Promise<{ records: HCRecord[]; deletedExternalIds: string[]; nextChangesToken: string | null }>;
}

/** Supabase push/pull seam; faked in tests. */
export interface RemoteStore {
  pushUpserts(rows: BodyMetricRow[]): Promise<void>;
  pullUpdatedSince(sinceIso: string | null): Promise<BodyMetricRow[]>;
}

export interface SyncDeps {
  hc: HealthConnectAdapter;
  store: BodyMetricsStore;
  remote: RemoteStore;
  toLocalDate: InstantToLocalDate;
}

export const SYNC_THROTTLE_MINUTES = 15;
export const FIRST_RUN_BACKFILL_DAYS = 75; // BRD §5: 60–90 days
export const READ_TYPES: MetricType[] = [
  'weight',
  'body_fat',
  'lean_mass',
  'bone_mass',
  'height',
  'bmr',
];

/**
 * Data-Sync BRD §5 — sync-on-open. Health Connect ingest, then outbox push and
 * remote pull. HC being absent or denied never blocks the rest (manual-only
 * mode); remote failures are expected offline and never block HC ingest.
 */
export async function syncOnOpen(
  deps: SyncDeps,
  nowUtc: string,
  opts?: { force?: boolean },
): Promise<SyncResult> {
  const { hc, store, remote, toLocalDate } = deps;

  const lastSyncAt = await store.getKV(KV.lastSyncAt);
  if (
    !opts?.force &&
    lastSyncAt !== null &&
    Date.parse(nowUtc) - Date.parse(lastSyncAt) < SYNC_THROTTLE_MINUTES * 60_000
  ) {
    return { ran: false, hc: 'synced', upserted: 0, deleted: 0, pushed: 0, pulled: 0, remoteError: null };
  }

  let hcOutcome: SyncResult['hc'];
  let upserted = 0;
  let deleted = 0;

  const status = await hc.getSdkStatus();
  if (status !== 'available') {
    hcOutcome = status;
  } else {
    const granted = await hc.ensurePermissions(READ_TYPES);
    if (!granted.includes('weight')) {
      // Weight is the only must-have (BRD §4); partial grants are valid.
      hcOutcome = 'permission_denied';
    } else {
      const changesToken = await store.getKV(KV.hcChangesToken);
      const sinceIso = new Date(
        Date.parse(nowUtc) - FIRST_RUN_BACKFILL_DAYS * 86_400_000,
      ).toISOString();
      const result = await hc.read({ changesToken, sinceIso, untilIso: nowUtc });

      for (const rec of result.records) {
        const row = normalizeRecord(rec, toLocalDate, nowUtc);
        if (row === null) continue; // future-dated guard
        await store.upsert(row);
        upserted += 1;
      }
      for (const externalId of result.deletedExternalIds) {
        if (await store.softDelete('health_connect', externalId, nowUtc)) deleted += 1;
      }
      if (result.nextChangesToken !== null) {
        await store.setKV(KV.hcChangesToken, result.nextChangesToken);
      }
      hcOutcome = 'synced';
    }
  }

  let pushed = 0;
  let pulled = 0;
  let remoteError: string | null = null;
  try {
    const pending = await store.listPendingPush();
    if (pending.length > 0) {
      await remote.pushUpserts(pending);
      await store.markPushed(pending.map((r) => r.id));
      pushed = pending.length;
    }

    const lastPulledAt = await store.getKV(KV.lastPulledAt);
    const remoteRows = await remote.pullUpdatedSince(lastPulledAt);
    for (const row of remoteRows) {
      const local = await store.get(row.source, row.externalId);
      if (local?.pendingPush) continue; // local unpushed edit wins over the pull
      await store.upsert({ ...row, pendingPush: false });
      pulled += 1;
    }
    await store.setKV(KV.lastPulledAt, nowUtc);
  } catch (e) {
    remoteError = e instanceof Error ? e.message : String(e); // offline is normal; retry next sync
  }

  await store.setKV(KV.lastSyncAt, nowUtc);
  return { ran: true, hc: hcOutcome, upserted, deleted, pushed, pulled, remoteError };
}
