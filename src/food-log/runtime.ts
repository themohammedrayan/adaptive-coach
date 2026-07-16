import { Platform } from 'react-native';
import { deviceLocalDate, type InstantToLocalDate } from './dates';
import type { FoodLogStore } from './store';
import { MemoryStore } from './store.memory';

/**
 * App-side singleton wiring the store to the device (or, on web, an
 * in-memory store — same rationale as data-sync/runtime.ts).
 */
export interface FoodLogRuntime {
  store: FoodLogStore;
  nowUtc(): string;
  toLocalDate: InstantToLocalDate;
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
  return { store, nowUtc: () => new Date().toISOString(), toLocalDate: deviceLocalDate };
}

export function getFoodLogRuntime(): Promise<FoodLogRuntime> {
  if (instance === null) instance = create();
  return instance;
}
