import type { ChallengeProgress } from '../dashboard/challenge';
import type { IsoDate } from '../engine';
import type { WallpaperSnapshot } from './types';

/** Projects the fields the live wallpaper displays out of an already-computed ChallengeProgress. */
export function buildWallpaperSnapshot(progress: ChallengeProgress, updatedAt: IsoDate): WallpaperSnapshot {
  return {
    daysElapsed: progress.daysElapsed,
    daysRemaining: progress.daysRemaining,
    horizonDays: progress.horizonDays,
    bankedKcal: progress.bankedKcal,
    totalBudgetKcal: progress.totalBudgetKcal,
    percentComplete: progress.percentComplete,
    updatedAt,
  };
}
