import type { EngineResult, EngineState, IsoDate, Profile } from '../engine';
import { DEFAULT_REMINDER_CONFIG } from './constants';
import type { DashboardStore } from './store';
import type { ReminderConfig } from './types';

/** In-memory store for tests (and web runtime). Mirrors the SQLite implementation's semantics. */
export class MemoryStore implements DashboardStore {
  profile: Profile | null = null;
  engineState: EngineState | null = null;
  lastResult: { computedAt: IsoDate; result: EngineResult } | null = null;
  reminderConfig: ReminderConfig | null = null;

  async getProfile(): Promise<Profile | null> {
    return this.profile;
  }

  async setProfile(profile: Profile): Promise<void> {
    this.profile = profile;
  }

  async getEngineState(): Promise<EngineState | null> {
    return this.engineState;
  }

  async setEngineState(state: EngineState): Promise<void> {
    this.engineState = state;
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
}
