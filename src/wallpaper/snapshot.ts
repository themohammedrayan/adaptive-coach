import type { ChallengeProgress } from '../dashboard/challenge';
import type { IsoDate } from '../engine';
import type { FinanceWallpaperBits } from '../finance/wallpaperBits';
import type { WallpaperSnapshot } from './types';

/** Projects the fields the live wallpaper displays out of an already-computed ChallengeProgress. */
export function buildWallpaperSnapshot(
  progress: ChallengeProgress,
  updatedAt: IsoDate,
  financeBits: FinanceWallpaperBits | null = null,
): WallpaperSnapshot {
  return {
    daysElapsed: progress.daysElapsed,
    daysRemaining: progress.daysRemaining,
    horizonDays: progress.horizonDays,
    bankedKcal: progress.bankedKcal,
    totalBudgetKcal: progress.totalBudgetKcal,
    percentComplete: progress.percentComplete,
    updatedAt,
    ...(financeBits !== null ? { finance: financeBits } : {}),
  };
}
