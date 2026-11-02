import { Platform } from 'react-native';
import type { DashboardStore } from './store';

/** App-side singleton wiring the store to the device (or a localStorage-backed store on web). */
export interface DashboardRuntime {
  store: DashboardStore;
}

let instance: Promise<DashboardRuntime> | null = null;

async function create(): Promise<DashboardRuntime> {
  let store: DashboardStore;
  if (Platform.OS === 'web') {
    const { LocalStorageStore } = await import('./store.local');
    store = new LocalStorageStore();
  } else {
    const { SQLiteStore } = await import('./store.sqlite');
    store = await SQLiteStore.open();
  }
  return { store };
}

export function getDashboardRuntime(): Promise<DashboardRuntime> {
  if (instance === null) instance = create();
  return instance;
}
