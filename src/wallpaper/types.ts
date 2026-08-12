import type { IsoDate } from '../engine';
import type { FinanceWallpaperBits } from '../finance/wallpaperBits';

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
  /**
   * Absent when there's no debt to show. Deliberately ratios/counts only —
   * never amounts — so a second, unlabeled ring reads as a generic progress
   * indicator to anyone but the owner.
   */
  finance?: FinanceWallpaperBits;
}
