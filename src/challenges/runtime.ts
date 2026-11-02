import { Platform } from 'react-native';
import type { ChallengeStore } from './store';
import { SyncedChallengeStore, type ChallengeSyncResult } from './sync';

/**
 * App-side singleton: the device store (SQLite, or localStorage on web)
 * wrapped so challenges sync to Supabase public.challenges.
 */
export interface ChallengeRuntime {
  store: ChallengeStore;
  /** Two-way reconcile with Supabase; throws when offline. */
  sync(): Promise<ChallengeSyncResult>;
}

let instance: Promise<ChallengeRuntime> | null = null;

async function create(): Promise<ChallengeRuntime> {
  let base: ChallengeStore;
  if (Platform.OS === 'web') {
    const { LocalStorageStore } = await import('./store.local');
    base = new LocalStorageStore();
  } else {
    const { SQLiteStore } = await import('./store.sqlite');
    base = await SQLiteStore.open();
  }
  // Lazy: the Supabase client throws at import when env vars are unset (tests).
  const { SupabaseChallengeRemote } = await import('./remote');
  const store = new SyncedChallengeStore(base, new SupabaseChallengeRemote());
  return { store, sync: () => store.sync() };
}

export function getChallengeRuntime(): Promise<ChallengeRuntime> {
  if (instance === null) instance = create();
  return instance;
}
