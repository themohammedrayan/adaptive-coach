import { buildChallengeProgress } from '../../dashboard/challenge';
import { buildWallpaperSnapshot } from '../snapshot';

const KCAL_PER_KG = 7700;
const GOAL = 80;
const START_DATE = '2026-01-01';
const HORIZON_DAYS = 180;
const UPDATED_AT = '2026-01-22T09:00:00.000Z';

describe('buildWallpaperSnapshot', () => {
  it('projects daysRemaining/bankedKcal/totalBudgetKcal from ChallengeProgress', () => {
    const progress = buildChallengeProgress(GOAL, START_DATE, HORIZON_DAYS, 100, 95, '2026-06-01', '2026-01-22', KCAL_PER_KG);
    const snapshot = buildWallpaperSnapshot(progress, UPDATED_AT);

    expect(snapshot.daysElapsed).toBe(progress.daysElapsed);
    expect(snapshot.daysRemaining).toBe(progress.daysRemaining);
    expect(snapshot.horizonDays).toBe(progress.horizonDays);
    expect(snapshot.bankedKcal).toBe(progress.bankedKcal);
    expect(snapshot.totalBudgetKcal).toBe(progress.totalBudgetKcal);
    expect(snapshot.percentComplete).toBe(progress.percentComplete);
    expect(snapshot.updatedAt).toBe(UPDATED_AT);
  });

  it('carries percentComplete null through for maintain-mode challenges', () => {
    const progress = buildChallengeProgress(100, START_DATE, HORIZON_DAYS, 100, 100, '2026-06-01', '2026-01-22', KCAL_PER_KG);
    const snapshot = buildWallpaperSnapshot(progress, UPDATED_AT);

    expect(snapshot.totalBudgetKcal).toBe(0);
    expect(snapshot.percentComplete).toBeNull();
  });
});
