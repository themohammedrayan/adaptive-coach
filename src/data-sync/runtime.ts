import { Platform } from 'react-native';
import { addDays } from '../engine';
import { createHealthConnectAdapter } from './hc/adapter';
import { addManualMetric } from './manual';
import { deviceLocalDate } from './normalize';
import { SupabaseRemote } from './remote';
import type { BodyMetricsStore } from './store';
import { MemoryStore } from './store.memory';
import { syncOnOpen, type SyncDeps } from './sync';
import type { BodyMetricRow, SyncResult } from './types';

/**
 * App-side singleton wiring the pure sync core to the real store/adapter/remote.
 * Web gets an in-memory store (no expo-sqlite wasm setup) — the web surface is
 * read-heavy and non-primary per the Master BRD.
 */
export interface DataSyncRuntime {
  store: BodyMetricsStore;
  sync(force?: boolean): Promise<SyncResult>;
  addWeightKg(weightKg: number): Promise<BodyMetricRow>;
  listRecentWeights(days?: number): Promise<BodyMetricRow[]>;
}

let instance: Promise<DataSyncRuntime> | null = null;

async function create(): Promise<DataSyncRuntime> {
  let store: BodyMetricsStore;
  if (Platform.OS === 'web') {
    store = new MemoryStore();
  } else {
    const { SQLiteStore } = await import('./store.sqlite');
    store = await SQLiteStore.open();
  }

  const deps: SyncDeps = {
    hc: createHealthConnectAdapter(),
    store,
    remote: new SupabaseRemote(),
    toLocalDate: deviceLocalDate,
  };

  return {
    store,
    sync: (force = false) => syncOnOpen(deps, new Date().toISOString(), { force }),
    addWeightKg: (weightKg) =>
      addManualMetric(
        store,
        { metricType: 'weight', valueSI: weightKg, recordedAtUtc: new Date().toISOString() },
        deviceLocalDate,
        new Date().toISOString(),
      ),
    listRecentWeights: async (days = 60) => {
      const end = deviceLocalDate(new Date().toISOString());
      const rows = await store.listByType('weight', { start: addDays(end, -days), end });
      return rows.reverse(); // newest first for display
    },
  };
}

export function getDataSyncRuntime(): Promise<DataSyncRuntime> {
  if (instance === null) instance = create();
  return instance;
}
