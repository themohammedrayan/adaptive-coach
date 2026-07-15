import type { DayLog, EngineConfig, Profile } from './types';

export interface WindowData {
  /** Logs inside the window (any `logged: false` entries are ignored). */
  logs: DayLog[];
  /** Trend weight at the window start (earliest available point in the window). */
  trendStartKg: number | null;
  /** Trend weight at the window end (today). */
  trendEndKg: number | null;
  windowDays: number;
}

/**
 * Engine BRD §5.2 — TDEE from intake + trend change.
 * Intake averages logged days only (never impute zeros); the trend term is
 * applied across the full window regardless of logging gaps.
 */
export function estimateTDEE(win: WindowData, cfg: EngineConfig): number | null {
  const logged = win.logs.filter((l) => l.logged);
  if (logged.length === 0 || win.trendStartKg === null || win.trendEndKg === null) return null;
  const avgIntake = logged.reduce((s, l) => s + l.kcal, 0) / logged.length;
  const deltaTrend = win.trendEndKg - win.trendStartKg;
  return avgIntake - (deltaTrend * cfg.kcalPerKg) / win.windowDays;
}

/** Mifflin–St Jeor resting metabolic rate. */
export function rmrMifflinStJeor(p: Pick<Profile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

/**
 * Engine BRD §5.3 — ramp from formula seed (day 1) to pure data (full window).
 * Returns the blended TDEE plus the seed's share for legibility.
 */
export function coldStartBlend(
  tdeeEst: number | null,
  profile: Profile,
  trendWeightKg: number,
  dataDays: number,
  cfg: EngineConfig,
): { tdeeUsed: number; seedShare: number } {
  const seed = rmrMifflinStJeor(profile, trendWeightKg) * profile.activityFactor;
  if (tdeeEst === null) return { tdeeUsed: seed, seedShare: 1 };
  const w = Math.min(1, Math.max(0, dataDays / cfg.windowDays));
  return { tdeeUsed: w * tdeeEst + (1 - w) * seed, seedShare: 1 - w };
}
