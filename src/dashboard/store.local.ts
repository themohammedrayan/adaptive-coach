import type { EngineResult, IsoDate } from '../engine';
import { readJson, writeJson } from '../lib/webStorage';
import { MemoryStore } from './store.memory';
import type { PersonProfile, ReminderConfig } from './types';

const KEY = 'adaptive-coach:dashboard:v1';

interface Snapshot {
  profile: PersonProfile | null;
  lastResult: { computedAt: IsoDate; result: EngineResult } | null;
  reminderConfig: ReminderConfig | null;
}

/**
 * Web runtime store: MemoryStore semantics, persisted to localStorage so the
 * profile / cached engine result survive a page reload. Device-local like the
 * SQLite store — not synced across devices.
 */
export class LocalStorageStore extends MemoryStore {
  constructor() {
    super();
    const snap = readJson<Snapshot>(KEY);
    if (snap) {
      this.profile = snap.profile;
      this.lastResult = snap.lastResult;
      this.reminderConfig = snap.reminderConfig;
    }
  }

  private persist(): void {
    const snap: Snapshot = { profile: this.profile, lastResult: this.lastResult, reminderConfig: this.reminderConfig };
    writeJson(KEY, snap);
  }

  async setProfile(profile: PersonProfile): Promise<void> {
    await super.setProfile(profile);
    this.persist();
  }

  async setLastResult(computedAt: IsoDate, result: EngineResult): Promise<void> {
    await super.setLastResult(computedAt, result);
    this.persist();
  }

  async setReminderConfig(config: ReminderConfig): Promise<void> {
    await super.setReminderConfig(config);
    this.persist();
  }

  async clearAll(): Promise<void> {
    await super.clearAll();
    writeJson(KEY, null);
  }
}
