import type { EngineResult, EngineState, IsoDate, Profile } from '../engine';
import type { ReminderConfig } from './types';

/**
 * Local persistence contract. One combined store for Profile, the Engine
 * snapshot (state + last result), and reminder config — all tiny
 * single-row settings, not growing collections. Implementations: SQLite
 * (device), in-memory (tests/web).
 */
export interface DashboardStore {
  getProfile(): Promise<Profile | null>;
  setProfile(profile: Profile): Promise<void>;

  getEngineState(): Promise<EngineState | null>;
  setEngineState(state: EngineState): Promise<void>;

  getLastResult(): Promise<{ computedAt: IsoDate; result: EngineResult } | null>;
  setLastResult(computedAt: IsoDate, result: EngineResult): Promise<void>;

  /** Returns DEFAULT_REMINDER_CONFIG when unset. */
  getReminderConfig(): Promise<ReminderConfig>;
  setReminderConfig(config: ReminderConfig): Promise<void>;
}
