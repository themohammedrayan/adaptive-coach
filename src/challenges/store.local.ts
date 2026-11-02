import { readJson, writeJson } from '../lib/webStorage';
import { MemoryStore } from './store.memory';
import type { Challenge } from './types';

const KEY = 'adaptive-coach:challenges:v1';

/**
 * Web runtime store: MemoryStore semantics, persisted to localStorage so
 * challenges survive a page reload. Device-local, not synced across devices.
 */
export class LocalStorageStore extends MemoryStore {
  constructor() {
    super();
    for (const c of readJson<Challenge[]>(KEY) ?? []) this.challenges.set(c.id, c);
  }

  async upsert(challenge: Challenge): Promise<void> {
    await super.upsert(challenge);
    writeJson(KEY, [...this.challenges.values()]);
  }

  async clearAll(): Promise<void> {
    await super.clearAll();
    writeJson(KEY, null);
  }
}
