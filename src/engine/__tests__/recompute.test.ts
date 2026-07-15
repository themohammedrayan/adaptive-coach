import { addDays } from '../dates';
import { nextEngineState, recompute } from '../recompute';
import type { DayLog, EngineState, Measurement, Profile } from '../types';

const TODAY = '2026-07-15';

const profile = (overrides?: Partial<Profile>): Profile => ({
  sex: 'male',
  age: 30,
  heightCm: 175,
  activityFactor: 1.5,
  goalWeightKg: 90,
  horizonDays: 180,
  startDate: addDays(TODAY, -30),
  mode: 'lose',
  ...overrides,
});

const freshState = (overrides?: Partial<EngineState>): EngineState => ({
  prevTargetKcal: null,
  mode: 'lose',
  lastRecomputeDate: null,
  startWeightKg: 100,
  ...overrides,
});

/** n daily weigh-ins ending today; weightFn maps day index (0 = oldest) to kg. */
const weighIns = (n: number, weightFn: (i: number) => number): Measurement[] =>
  Array.from({ length: n }, (_, i) => ({
    date: addDays(TODAY, -(n - 1 - i)),
    weightKg: weightFn(i),
    source: 'health_connect' as const,
  }));

/** n daily logs ending today, all at the same kcal. */
const logs = (n: number, kcal: number): DayLog[] =>
  Array.from({ length: n }, (_, i) => ({
    date: addDays(TODAY, -(n - 1 - i)),
    kcal,
    protein: 0,
    carb: 0,
    fat: 0,
    fiber: 0,
    logged: true,
  }));

describe('recompute — BRD §8 acceptance tests', () => {
  it('1. steady loss: deep-deficit goal hits the loss-rate cap', () => {
    const res = recompute(
      freshState(),
      profile({ goalWeightKg: 80, horizonDays: 90 }), // needs ~2.5x the safe rate
      weighIns(30, (i) => 100 - i / 30), // −1 kg over 30 days
      logs(14, 2000),
      TODAY,
      { calorieFloorKcal: 900 },
    )!;
    expect(res.boundHit).toBe('lossRateCap');
    // target = tdeeUsed − 1%·bw·7700/7, from the engine's own reported inputs
    const maxDeficit = (0.01 * res.trendWeightKg * 7700) / 7;
    expect(res.targetKcal).toBe(Math.round(res.tdeeUsed! - maxDeficit));
    expect(res.tdeeEst!).toBeGreaterThan(2000); // losing on 2000 → burn exceeds intake
  });

  it('2. under-logging self-heal: flat trend → no deficit, stall flagged, no crash-chasing', () => {
    const res = recompute(
      freshState(),
      profile(),
      weighIns(30, () => 100), // trend flat
      logs(14, 1400), // understated intake
      TODAY,
    )!;
    // floor (max(1500, RMR=1948.75)) prevents chasing the phantom deficit
    expect(res.boundHit).toBe('calorieFloor');
    expect(res.targetKcal).toBe(1949);
    expect(res.effectiveDeficit!).toBeLessThanOrEqual(0);
    expect(res.projectedFinishDate).toBeNull();
    expect(res.reasons).toContainEqual(
      expect.objectContaining({ code: 'TREND_STALLED' }),
    );
  });

  it('3. missing data: 6 logged days → hold previous target', () => {
    const res = recompute(
      freshState({ prevTargetKcal: 2000, lastRecomputeDate: addDays(TODAY, -7) }),
      profile(),
      weighIns(14, () => 100),
      logs(6, 2000),
      TODAY,
    )!;
    expect(res.targetKcal).toBe(2000);
    expect(res.boundHit).toBe('insufficientData');
    expect(res.tdeeEst).toBeNull();
    expect(res.reasons).toContainEqual(
      expect.objectContaining({ code: 'INSUFFICIENT_DATA', loggedDays: 6 }),
    );
  });

  it('4. move limit: computed 1751 vs previous 2000 → clamped to 1875', () => {
    const res = recompute(
      freshState({ prevTargetKcal: 2000, lastRecomputeDate: addDays(TODAY, -7) }),
      // 33 days elapsed of 180 → 147 remaining → required ≈ −524 kcal/day
      profile({ startDate: addDays(TODAY, -33) }),
      weighIns(30, () => 100), // flat trend → tdee = intake = 2275
      logs(14, 2275),
      TODAY,
      { calorieFloorKcal: 1500 },
    )!;
    expect(res.targetKcal).toBe(1875);
    expect(res.boundHit).toBe('moveLimit');
    expect(res.reasons).toContainEqual(
      expect.objectContaining({ code: 'TARGET_CHANGED', from: 2000, to: 1875, deltaKcal: -125 }),
    );
  });

  it('5. calorie floor: computed 1200 → floored, even inside the move window', () => {
    const res = recompute(
      freshState({ prevTargetKcal: 1300, lastRecomputeDate: addDays(TODAY, -7) }),
      // 26 days elapsed of 180 → 154 remaining → required = −500 exactly
      profile({ startDate: addDays(TODAY, -26) }),
      weighIns(30, () => 100),
      logs(14, 1700), // flat trend → tdee 1700 → raw target 1200
      TODAY,
    )!;
    expect(res.targetKcal).toBe(1949); // max(1500, RMR 1948.75)
    expect(res.boundHit).toBe('calorieFloor');
  });

  it('6. cold start day 3: mostly formula seed', () => {
    const res = recompute(
      freshState(),
      profile({ startDate: addDays(TODAY, -3) }),
      weighIns(3, () => 100),
      logs(3, 1800),
      TODAY,
    )!;
    const seed = 1948.75 * 1.5; // RMR × activity
    const w = 3 / 14;
    expect(res.dataStatus.coldStartWeight).toBeCloseTo(1 - w, 6);
    expect(res.tdeeUsed!).toBeCloseTo(w * 1800 + (1 - w) * seed, 3);
    expect(res.reasons).toContainEqual(expect.objectContaining({ code: 'COLD_START' }));
  });

  it('7. macro reconciliation: heavy user + low target preserves protein, warns', () => {
    const res = recompute(
      freshState(),
      profile({ goalWeightKg: 115 }),
      weighIns(30, () => 120),
      logs(14, 1500),
      TODAY,
      { calorieFloorKcal: 1400 },
    )!;
    expect(res.targetKcal).toBeLessThanOrEqual(1500);
    expect(res.macros.proteinG).toBe(216); // 1.8 · 120, never sacrificed
    expect(res.macros.fatG).toBe(72); // pinned at 0.6 g/kg floor
    expect(res.macros.carbG).toBe(50); // pinned at CARB_MIN_G
    expect(res.macroWarning).not.toBeNull();
    expect(res.reasons).toContainEqual(
      expect.objectContaining({ code: 'MACRO_RECONCILED' }),
    );
  });
});

describe('recompute gate (BRD §5.8)', () => {
  const fullData = {
    measurements: weighIns(30, () => 100),
    logs: logs(14, 2000),
  };

  it('no-ops inside the weekly interval', () => {
    const res = recompute(
      freshState({ prevTargetKcal: 2000, lastRecomputeDate: addDays(TODAY, -3) }),
      profile(),
      fullData.measurements,
      fullData.logs,
      TODAY,
    );
    expect(res).toBeNull();
  });

  it('force bypasses the interval gate', () => {
    const res = recompute(
      freshState({ prevTargetKcal: 2000, lastRecomputeDate: addDays(TODAY, -3) }),
      profile(),
      fullData.measurements,
      fullData.logs,
      TODAY,
      undefined,
      { force: true },
    );
    expect(res).not.toBeNull();
  });

  it('first run computes even with sparse data (cold start, no hold)', () => {
    const res = recompute(freshState(), profile(), weighIns(2, () => 100), logs(2, 1800), TODAY)!;
    expect(res).not.toBeNull();
    expect(res.boundHit).not.toBe('insufficientData');
    expect(res.targetKcal).toBeGreaterThan(0);
  });

  it('nextEngineState persists the new target and recompute date', () => {
    const state = freshState();
    const res = recompute(state, profile(), fullData.measurements, fullData.logs, TODAY)!;
    const next = nextEngineState(state, res, TODAY);
    expect(next.prevTargetKcal).toBe(res.targetKcal);
    expect(next.lastRecomputeDate).toBe(TODAY);
    expect(next.startWeightKg).toBe(100);
  });

  it('is deterministic: same inputs → same output', () => {
    const run = () =>
      recompute(freshState(), profile(), fullData.measurements, fullData.logs, TODAY);
    expect(run()).toEqual(run());
  });
});
