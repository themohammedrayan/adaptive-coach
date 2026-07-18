import { Platform } from 'react-native';
import { deviceLocalDate, type InstantToLocalDate } from './dates';
import type { FoodLogStore } from './store';
import { MemoryStore } from './store.memory';
import { foodLogSyncOnOpen, type FoodLogSyncResult } from './sync';

/**
 * App-side singleton wiring the store to the device (or, on web, an
 * in-memory store — same rationale as data-sync/runtime.ts).
 */
export interface FoodLogRuntime {
  store: FoodLogStore;
  nowUtc(): string;
  toLocalDate: InstantToLocalDate;
  sync(force?: boolean): Promise<FoodLogSyncResult>;
}

let instance: Promise<FoodLogRuntime> | null = null;

async function create(): Promise<FoodLogRuntime> {
  let store: FoodLogStore;
  if (Platform.OS === 'web') {
    store = new MemoryStore();
  } else {
    const { SQLiteStore } = await import('./store.sqlite');
    store = await SQLiteStore.open();
  }
  // Lazy import — mirrors the SQLiteStore branch above: the Supabase client
  // throws at module-eval time when env vars are unset, so importing it eagerly
  // would break any test that merely references getFoodLogRuntime without calling it.
  const { SupabaseRemote } = await import('./remote');
  const remote = new SupabaseRemote();
  return {
    store,
    nowUtc: () => new Date().toISOString(),
    toLocalDate: deviceLocalDate,
    sync: (force = false) => foodLogSyncOnOpen({ store, remote }, new Date().toISOString(), { force }),
  };
}

export function getFoodLogRuntime(): Promise<FoodLogRuntime> {
  if (instance === null) instance = create();
  return instance;
}
