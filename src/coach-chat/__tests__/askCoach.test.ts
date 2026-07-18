const mockAskCoach = jest.fn();
jest.mock('../remote', () => ({ askCoach: (...args: unknown[]) => mockAskCoach(...args) }));

import { MemoryStore as DataSyncMemoryStore } from '../../data-sync';
import type { BodyMetricRow } from '../../data-sync';
import { MemoryStore as DashboardMemoryStore } from '../../dashboard/store.memory';
import type { EngineResult, EngineState, Profile } from '../../engine';
import { addLogEntry, createFood, MemoryStore as FoodLogMemoryStore } from '../../food-log';
import { askCoachQuestion } from '../askCoach';

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

const ENGINE_STATE: EngineState = {
  prevTargetKcal: 2100,
  mode: 'lose',
  lastRecomputeDate: '2026-07-08',
  startWeightKg: 90,
};

const ENGINE_RESULT: EngineResult = {
  targetKcal: 1975,
  macros: { proteinG: 180, fatG: 60, carbG: 170, fiberG: 28 },
  macroWarning: null,
  tdeeEst: 2450,
  tdeeUsed: 2450,
  energyBalancePerDay: -475,
  effectiveDeficit: 475,
  projectedFinishDate: '2026-12-30',
  trendWeightKg: 88,
  weeklyRateKg: -0.35,
  boundHit: 'none',
  dataStatus: { loggedDays: 11, weighIns: 12, coldStartWeight: 0 },
  reasons: [],
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

async function seedDeps(opts?: { skipEngineState?: boolean; skipResult?: boolean }) {
  const dashboardStore = new DashboardMemoryStore();
  const foodLogStore = new FoodLogMemoryStore();
  const dataSyncStore = new DataSyncMemoryStore();

  await dashboardStore.setProfile(PROFILE);
  if (!opts?.skipEngineState) await dashboardStore.setEngineState(ENGINE_STATE);
  if (!opts?.skipResult) await dashboardStore.setLastResult(TODAY, ENGINE_RESULT);

  for (let i = 0; i < 5; i++) {
    const date = `2026-07-${String(6 + i).padStart(2, '0')}`;
    await dataSyncStore.upsert(weightRow(date, 88 - i * 0.1));
  }

  const food = await createFood(
    foodLogStore,
    { name: 'Rice', proteinPer100g: 2.7, carbPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, defaultUnitId: 'katori' },
    '2026-07-01T00:00:00.000Z',
  );
  for (let i = 0; i < 5; i++) {
    const date = `2026-07-${String(6 + i).padStart(2, '0')}`;
    await addLogEntry(
      foodLogStore,
      { foodId: food.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: `${date}T12:00:00.000Z` },
      (iso) => iso.slice(0, 10),
    );
  }

  return { dashboardStore, foodLogStore, dataSyncStore };
}

beforeEach(() => {
  mockAskCoach.mockReset();
});

describe('askCoachQuestion — v2 ad-hoc Q&A orchestrator', () => {
  it('returns no-data when there is no cached engine result yet', async () => {
    const deps = await seedDeps({ skipResult: true });
    const result = await askCoachQuestion(deps, 'Why did my target drop?', TODAY);
    expect(result).toEqual({ status: 'no-data' });
    expect(mockAskCoach).not.toHaveBeenCalled();
  });

  it('returns no-data when no profile/engine state has been set up', async () => {
    const dashboardStore = new DashboardMemoryStore();
    const foodLogStore = new FoodLogMemoryStore();
    const dataSyncStore = new DataSyncMemoryStore();
    const result = await askCoachQuestion(
      { dashboardStore, foodLogStore, dataSyncStore },
      'Why did my target drop?',
      TODAY,
    );
    expect(result).toEqual({ status: 'no-data' });
  });

  it('builds a payload from the cached result and asks the coach, without recomputing', async () => {
    const deps = await seedDeps();
    mockAskCoach.mockResolvedValue({
      id: 'turn-1',
      question: 'Why did my target drop?',
      answer: 'Your trend stalled, so estimated burn dropped.',
      source: 'model',
      model: 'gpt-5-mini',
      generatedAt: '2026-07-15T09:00:00.000Z',
      payloadHash: 'abc123',
    });

    const result = await askCoachQuestion(deps, 'Why did my target drop?', TODAY);

    expect(result.status).toBe('ok');
    expect(mockAskCoach).toHaveBeenCalledTimes(1);
    const [requestId, question, payload, history] = mockAskCoach.mock.calls[0];
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
    expect(question).toBe('Why did my target drop?');
    expect(payload.current.targetKcal).toBe(ENGINE_RESULT.targetKcal);
    expect(payload.goal.startWeightKg).toBe(ENGINE_STATE.startWeightKg);
    expect(history).toEqual([]);

    // Cached engine state must be untouched — this never recomputes.
    const stateAfter = await deps.dashboardStore.getEngineState();
    expect(stateAfter).toEqual(ENGINE_STATE);
  });

  it('passes conversation history through to the remote call', async () => {
    const deps = await seedDeps();
    mockAskCoach.mockResolvedValue({
      id: 'turn-2',
      question: 'And after that?',
      answer: 'Following the same trend.',
      source: 'model',
      model: 'gpt-5-mini',
      generatedAt: '2026-07-15T09:05:00.000Z',
      payloadHash: 'def456',
    });
    const history = [{ question: 'Why did my target drop?', answer: 'Your trend stalled.' }];

    await askCoachQuestion(deps, 'And after that?', TODAY, history);

    const [, , , passedHistory] = mockAskCoach.mock.calls[0];
    expect(passedHistory).toEqual(history);
  });
});
