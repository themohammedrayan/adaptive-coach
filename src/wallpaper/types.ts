import type { IsoDate } from '../engine';

/** Small denormalized payload the native live wallpaper reads — no logic lives on the Kotlin side. */
export interface WallpaperSnapshot {
  daysElapsed: number;
  daysRemaining: number;
  horizonDays: number;
  bankedKcal: number;
  totalBudgetKcal: number;
  /** null when totalBudgetKcal === 0 (maintain-mode challenge) — mirrors ChallengeProgress. */
  percentComplete: number | null;
  updatedAt: IsoDate;
}
