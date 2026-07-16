import { MemoryStore as DataSyncMemoryStore } from '../../data-sync';
import type { BodyMetricRow } from '../../data-sync';
import type { EngineState, Profile } from '../../engine';
import { addLogEntry, createFood, MemoryStore as FoodLogMemoryStore } from '../../food-log';
import { buildPlaceholderCoachNote } from '../coachNotePlaceholder';
import { notifyCoachNoteReady } from '../reminders';
import { refreshDashboardSnapshot } from '../refreshSnapshot';
import { MemoryStore as DashboardMemoryStore } from '../store.memory';

jest.mock('../reminders', () => ({ notifyCoachNoteReady: jest.fn().mockResolvedValue(undefined) }));

const TODAY = '2026-07-15';

const PROFILE: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  activityFactor: 1.55,
  goalWeightKg: 75,
  horizonDays: 180,
  startDate: '2026-06-01',
  mode: 'lose',
};

function freshState(): EngineState {
  return { prevTargetKcal: null, mode: 'lose', lastRecomputeDate: null, startWeightKg: 90 };
}

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

  await dashboardStore.setProfile(PROFILE);
  await dashboardStore.setEngineState(freshState());

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

  return { dashboardStore, foodLogStore, dataSyncStore };
}

describe('refreshDashboardSnapshot — Dashboard BRD §C AT7', () => {
  it('returns an empty snapshot when no Profile has been set up yet', async () => {
    const dashboardStore = new DashboardMemoryStore();
    const foodLogStore = new FoodLogMemoryStore();
    const dataSyncStore = new DataSyncMemoryStore();
    const snapshot = await refreshDashboardSnapshot(
      { dashboardStore, foodLogStore, dataSyncStore },
      TODAY,
    );
    expect(snapshot.profile).toBeNull();
    expect(snapshot.result).toBeNull();
  });

  it('a first recompute persists EngineState/EngineResult and fires notifyCoachNoteReady once with matching reasons', async () => {
    const deps = await seedDeps();
    const snapshot = await refreshDashboardSnapshot(deps, TODAY);

    expect(snapshot.result).not.toBeNull();
    expect(snapshot.resultComputedAt).toBe(TODAY);
    expect(snapshot.last14).toHaveLength(14);

    const persistedState = await deps.dashboardStore.getEngineState();
    expect(persistedState?.lastRecomputeDate).toBe(TODAY);
    const persistedResult = await deps.dashboardStore.getLastResult();
    expect(persistedResult?.result.targetKcal).toBe(snapshot.result?.targetKcal);

    expect(notifyCoachNoteReady).toHaveBeenCalledTimes(1);
    const [firedNote] = (notifyCoachNoteReady as jest.Mock).mock.calls[0];
    expect(firedNote).toEqual(buildPlaceholderCoachNote(snapshot.result!, TODAY));
  });

  it('holds the cached result and does not re-fire the reminder when the recompute gate has not elapsed', async () => {
    const deps = await seedDeps();
    await refreshDashboardSnapshot(deps, TODAY); // first recompute, sets lastRecomputeDate
    (notifyCoachNoteReady as jest.Mock).mockClear();

    const nextDaySnapshot = await refreshDashboardSnapshot(deps, '2026-07-16'); // 1 day later, gate not elapsed
    expect(nextDaySnapshot.resultComputedAt).toBe(TODAY); // still the cached computedAt
    expect(notifyCoachNoteReady).not.toHaveBeenCalled();
  });
});
