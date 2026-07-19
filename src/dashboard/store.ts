import type { EngineResult, IsoDate } from '../engine';
import type { PersonProfile, ReminderConfig } from './types';

/**
 * Local persistence contract. One combined store for the person-level
 * Profile, the cached EngineResult, and reminder config — all tiny
 * single-row settings, not growing collections. Goal-related state
 * (goalWeightKg/horizonDays/startWeightKg/prevTargetKcal/lastRecomputeDate)
 * lives on Challenge rows now (src/challenges), not here. Implementations:
 * SQLite (device), in-memory (tests/web).
 */
export interface DashboardStore {
  getProfile(): Promise<PersonProfile | null>;
  setProfile(profile: PersonProfile): Promise<void>;

  getLastResult(): Promise<{ computedAt: IsoDate; result: EngineResult } | null>;
  setLastResult(computedAt: IsoDate, result: EngineResult): Promise<void>;

  /** Returns DEFAULT_REMINDER_CONFIG when unset. */
  getReminderConfig(): Promise<ReminderConfig>;
  setReminderConfig(config: ReminderConfig): Promise<void>;

  /** Wipes profile, cached engine result, and reminder config — used by account reset. */
  clearAll(): Promise<void>;
}
