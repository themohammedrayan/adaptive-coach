import type { EngineResult, IsoDate } from '../engine';
import { DEFAULT_REMINDER_CONFIG } from './constants';
import type { DashboardStore } from './store';
import type { PersonProfile, ReminderConfig } from './types';

/** In-memory store for tests (and web runtime). Mirrors the SQLite implementation's semantics. */
export class MemoryStore implements DashboardStore {
  profile: PersonProfile | null = null;
  lastResult: { computedAt: IsoDate; result: EngineResult } | null = null;
  reminderConfig: ReminderConfig | null = null;

  async getProfile(): Promise<PersonProfile | null> {
    return this.profile;
  }

  async setProfile(profile: PersonProfile): Promise<void> {
    this.profile = profile;
  }

  async getLastResult(): Promise<{ computedAt: IsoDate; result: EngineResult } | null> {
    return this.lastResult;
  }

  async setLastResult(computedAt: IsoDate, result: EngineResult): Promise<void> {
    this.lastResult = { computedAt, result };
  }

  async getReminderConfig(): Promise<ReminderConfig> {
    return this.reminderConfig ?? DEFAULT_REMINDER_CONFIG;
  }

  async setReminderConfig(config: ReminderConfig): Promise<void> {
    this.reminderConfig = config;
  }

  async clearAll(): Promise<void> {
    this.profile = null;
    this.lastResult = null;
    this.reminderConfig = null;
  }
}
