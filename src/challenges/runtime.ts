import { Platform } from 'react-native';
import type { ChallengeStore } from './store';
import { MemoryStore } from './store.memory';

/** App-side singleton wiring the store to the device (or an in-memory store on web). */
export interface ChallengeRuntime {
  store: ChallengeStore;
}

let instance: Promise<ChallengeRuntime> | null = null;

async function create(): Promise<ChallengeRuntime> {
  let store: ChallengeStore;
  if (Platform.OS === 'web') {
    store = new MemoryStore();
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
