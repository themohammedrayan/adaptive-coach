import type { EngineResult, EngineState, IsoDate, Profile } from '../engine';
import type { DailyTotals } from '../food-log';

export interface Point {
  date: IsoDate;
  value: number;
}

export type Range = '30' | '90' | 'all';

export interface DayStatus {
  date: IsoDate;
  logged: boolean;
}

export type ReminderKind = 'morningWeighIn' | 'eveningLog' | 'coachNoteReady';

export interface ReminderTimeConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

/** Dashboard BRD §B2/§B3. coachNoteReady has no clock — it's event-driven off recompute. */
export interface ReminderConfig {
  morningWeighIn: ReminderTimeConfig;
  eveningLog: ReminderTimeConfig;
  coachNoteReady: { enabled: boolean };
}

/**
 * Dashboard BRD §A1 — the read-only snapshot the screen renders from.
 * `result`/`resultComputedAt` are the cached previous values when a
 * recompute holds (interval gate not yet elapsed); `last14` is the shared
 * trailing-14-day fetch reused for both the adherence strip and the
 * Engine's DayLog[] window.
 */
export interface DashboardSnapshot {
  profile: Profile | null;
  engineState: EngineState | null;
  result: EngineResult | null;
  resultComputedAt: IsoDate | null;
  last14: DailyTotals[];
}
