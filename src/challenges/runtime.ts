import { Platform } from 'react-native';
import type { ChallengeStore } from './store';

/** App-side singleton wiring the store to the device (or a localStorage-backed store on web). */
export interface ChallengeRuntime {
  store: ChallengeStore;
}

let instance: Promise<ChallengeRuntime> | null = null;

async function create(): Promise<ChallengeRuntime> {
  let store: ChallengeStore;
  if (Platform.OS === 'web') {
    const { LocalStorageStore } = await import('./store.local');
    store = new LocalStorageStore();
  } else {
    const { SQLiteStore } = await import('./store.sqlite');
    store = await SQLiteStore.open();
  }
  return { store };
}

export function getChallengeRuntime(): Promise<ChallengeRuntime> {
  if (instance === null) instance = create();
  return instance;
}
