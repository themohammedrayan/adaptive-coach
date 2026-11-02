import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { SyncedDashboardStore, type ProfileSyncOutcome, type SyncKV } from './profileSync';
import type { DashboardStore } from './store';

/**
 * App-side singleton: the device store (SQLite, or localStorage on web)
 * wrapped so the profile syncs to Supabase public.person_profiles.
 */
export interface DashboardRuntime {
  store: DashboardStore;
  /** Two-way profile reconcile with Supabase; throws when offline. */
  sync(): Promise<ProfileSyncOutcome>;
}

let instance: Promise<DashboardRuntime> | null = null;

const asyncStorageKV: SyncKV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => (v === null ? AsyncStorage.removeItem(k) : AsyncStorage.setItem(k, v)),
};

async function create(): Promise<DashboardRuntime> {
  let base: DashboardStore;
  if (Platform.OS === 'web') {
    const { LocalStorageStore } = await import('./store.local');
    base = new LocalStorageStore();
  } else {
    const { SQLiteStore } = await import('./store.sqlite');
    base = await SQLiteStore.open();
  }
  // Lazy: the Supabase client throws at import when env vars are unset (tests).
  const { SupabaseProfileRemote } = await import('./profileRemote');
  const store = new SyncedDashboardStore(base, new SupabaseProfileRemote(), asyncStorageKV);
  return { store, sync: () => store.sync() };
}

export function getDashboardRuntime(): Promise<DashboardRuntime> {
  if (instance === null) instance = create();
  return instance;
}
