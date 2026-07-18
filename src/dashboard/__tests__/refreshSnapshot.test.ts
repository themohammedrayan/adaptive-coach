const mockNote = {
  id: 'note-1',
  weekOf: '2026-07-15',
  changeExplanation: 'Target held.',
  weeklyReview: 'You logged 10 of 14 days.',
  stallRead: 'On track.',
  suggestion: 'Keep it up.',
  source: 'model' as const,
  model: 'claude-sonnet-5',
  generatedAt: '2026-07-15T09:00:00.000Z',
  payloadHash: 'abc123',
};

jest.mock('../reminders', () => ({ notifyCoachNoteReady: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../coaching', () => ({
  // gatherPayloadInputs stays real (requireActual straight from its
  // submodule, not the barrel — the barrel also re-exports remote.ts,
  // which needs live Supabase env vars this test suite doesn't set up).
  // It's shared with coach-chat's askCoach.ts and exercised here as a
  // regression check.
  gatherPayloadInputs: jest.requireActual('../../coaching/gatherPayloadInputs').gatherPayloadInputs,
  buildGoalSummary: jest.fn().mockReturnValue({ startWeightKg: 90, goalWeightKg: 75, horizonDays: 180, daysElapsed: 44 }),
  assembleCoachPayload: jest.fn().mockReturnValue({}),
  generateCoachNote: jest.fn(() => Promise.resolve(mockNote)),
}));

import { createChallenge, MemoryStore as ChallengeMemoryStore } from '../../challenges';
import { MemoryStore as DataSyncMemoryStore } from '../../data-sync';
import type { BodyMetricRow } from '../../data-sync';
import { addLogEntry, createFood, MemoryStore as FoodLogMemoryStore } from '../../food-log';
import { notifyCoachNoteReady } from '../reminders';
import { refreshDashboardSnapshot } from '../refreshSnapshot';
import { MemoryStore as DashboardMemoryStore } from '../store.memory';
import type { PersonProfile } from '../types';

const TODAY = '2026-07-15';

const PROFILE: PersonProfile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  activityFactor: 1.55,
};

function weightRow(localDate: string, kg: number): BodyMetricRow {
  return {
    id: `manual:${localDate}`,
    metricType: 'weight',
    valueSI: kg,
    source: 'manual',
    externalId: localDate,
    dataOrigin: null,
    recordedAtUtc: `${localDate}T07:00:00.000Z`,
    localDate,
    ingestedAt: `${localDate}T07:00:00.000Z`,
    deletedAt: null,
    pendingPush: false,
  };
}

async function seedDeps() {
  const dashboardStore = new DashboardMemoryStore();
  const foodLogStore = new FoodLogMemoryStore();
  const dataSyncStore = new DataSyncMemoryStore();
  const challengeStore = new ChallengeMemoryStore();

  await dashboardStore.setProfile(PROFILE);
  await createChallenge(
    challengeStore,
    { domain: 'weight', goalWeightKg: 75, startWeightKg: 90, horizonDays: 180 },
    '2026-06-01T00:00:00.000Z',
    '2026-06-01',
  );

  // 10 weigh-ins across the trailing window (>= minWeighIns=8).
  for (let i = 0; i < 10; i++) {
    const date = `2026-07-${String(6 + i).padStart(2, '0')}`;
    await dataSyncStore.upsert(weightRow(date, 88 - i * 0.1));
  }

  // 10 logged days (>= minLoggedDays=8).
  const food = await createFood(
    foodLogStore,
    { name: 'Rice', proteinPer100g: 2.7, carbPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, defaultUnitId: 'katori' },
    '2026-07-01T00:00:00.000Z',
  );
  for (let i = 0; i < 10; i++) {
    const date = `2026-07-${String(6 + i).padStart(2, '0')}`;
    await addLogEntry(
      foodLogStore,
      { foodId: food.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: `${date}T12:00:00.000Z` },
      (iso) => iso.slice(0, 10),
    );
  }

  return { dashboardStore, foodLogStore, dataSyncStore, challengeStore };
}

describe('refreshDashboardSnapshot — Dashboard BRD §C AT7', () => {
  it('returns an empty snapshot when no Profile has been set up yet', async () => {
    const dashboardStore = new DashboardMemoryStore();
    const foodLogStore = new FoodLogMemoryStore();
    const dataSyncStore = new DataSyncMemoryStore();
    const challengeStore = new ChallengeMemoryStore();
    const snapshot = await refreshDashboardSnapshot(
      { dashboardStore, foodLogStore, dataSyncStore, challengeStore },
      TODAY,
    );
    expect(snapshot.profile).toBeNull();
    expect(snapshot.result).toBeNull();
  });

  it('returns an empty result (but a non-null profile) when there is no primary challenge', async () => {
    const dashboardStore = new DashboardMemoryStore();
    const foodLogStore = new FoodLogMemoryStore();
    const dataSyncStore = new DataSyncMemoryStore();
    const challengeStore = new ChallengeMemoryStore();
    await dashboardStore.setProfile(PROFILE);
    const snapshot = await refreshDashboardSnapshot(
      { dashboardStore, foodLogStore, dataSyncStore, challengeStore },
      TODAY,
    );
    expect(snapshot.profile).not.toBeNull();
    expect(snapshot.primaryChallenge).toBeNull();
    expect(snapshot.result).toBeNull();
  });

  it('a first recompute persists Challenge bookkeeping/EngineResult and fires notifyCoachNoteReady once with matching reasons', async () => {
    const deps = await seedDeps();
    const snapshot = await refreshDashboardSnapshot(deps, TODAY);

    expect(snapshot.result).not.toBeNull();
    expect(snapshot.resultComputedAt).toBe(TODAY);
    expect(snapshot.last14).toHaveLength(14);

    const primary = await deps.challengeStore.getPrimary('weight');
    expect(primary?.lastRecomputeDate).toBe(TODAY);
    const persistedResult = await deps.dashboardStore.getLastResult();
    expect(persistedResult?.result.targetKcal).toBe(snapshot.result?.targetKcal);

    // The coach-note chain is fire-and-forget (generateCoachNote().then(notifyCoachNoteReady)) —
    // flush the microtask queue before asserting the mock was called.
    await Promise.resolve();
    await Promise.resolve();
    expect(notifyCoachNoteReady).toHaveBeenCalledTimes(1);
    expect(notifyCoachNoteReady).toHaveBeenCalledWith(mockNote);
  });

  it('holds the cached result and does not re-fire the reminder when the recompute gate has not elapsed', async () => {
    const deps = await seedDeps();
    await refreshDashboardSnapshot(deps, TODAY); // first recompute, sets lastRecomputeDate
    await Promise.resolve();
    await Promise.resolve();
    (notifyCoachNoteReady as jest.Mock).mockClear();

    const nextDaySnapshot = await refreshDashboardSnapshot(deps, '2026-07-16'); // 1 day later, gate not elapsed
    expect(nextDaySnapshot.resultComputedAt).toBe(TODAY); // still the cached computedAt
    expect(notifyCoachNoteReady).not.toHaveBeenCalled();
  });

  it('liveTrendWeightKg reflects a new weigh-in even while the weekly recompute gate holds the cached result', async () => {
    const deps = await seedDeps();
    await refreshDashboardSnapshot(deps, TODAY); // first recompute, sets lastRecomputeDate
    await Promise.resolve();
    await Promise.resolve();

    // A big overnight drop logged the next day — the gate holds `result` steady,
    // but the challenge card's live trend should still move toward it.
    await deps.dataSyncStore.upsert(weightRow('2026-07-16', 80));

    const nextDaySnapshot = await refreshDashboardSnapshot(deps, '2026-07-16');
    expect(nextDaySnapshot.resultComputedAt).toBe(TODAY); // result still held
    expect(nextDaySnapshot.liveTrendWeightKg).not.toBeNull();
    expect(nextDaySnapshot.liveTrendWeightKg).not.toBe(nextDaySnapshot.result?.trendWeightKg);
    expect(nextDaySnapshot.liveTrendWeightKg!).toBeLessThan(nextDaySnapshot.result!.trendWeightKg);
  });
});
