import type { EngineResult, TrendPoint } from '../../engine';
import { assembleCoachPayload } from '../assembleCoachPayload';
import type { AdherenceInput, GoalSummary } from '../types';

function result(overrides: Partial<EngineResult> = {}): EngineResult {
  return {
    targetKcal: 1975,
    macros: { proteinG: 180, fatG: 60, carbG: 170, fiberG: 28 },
    macroWarning: null,
    tdeeEst: 2450,
    tdeeUsed: 2450,
    energyBalancePerDay: -475,
    effectiveDeficit: 475,
    projectedFinishDate: '2026-12-30',
    trendWeightKg: 95,
    weeklyRateKg: -0.35,
    boundHit: 'moveLimit',
    dataStatus: { loggedDays: 11, weighIns: 12, coldStartWeight: 0 },
    reasons: [{ code: 'TARGET_CHANGED', from: 2100, to: 1975, deltaKcal: -125 }],
    ...overrides,
  };
}

const goal: GoalSummary = { startWeightKg: 100, goalWeightKg: 80, horizonDays: 180, daysElapsed: 21 };

const adherence: AdherenceInput = {
  days: [
    { date: '2026-07-01', logged: true },
    { date: '2026-07-02', logged: false },
    { date: '2026-07-03', logged: true },
  ],
  avgIntake: 2010,
  avgTarget: 2050,
};

const trend: TrendPoint[] = [{ date: '2026-07-01', rawKg: 95, trendKg: 95 }];

describe('assembleCoachPayload — Coaching BRD §11 AT1 (payload hygiene)', () => {
  it('contains only the aggregate fields, no raw food entries or PII', () => {
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend);
    expect(Object.keys(payload).sort()).toEqual(
      ['adherence', 'current', 'goal', 'goalSignals', 'goals', 'goalsAggregate', 'reasons', 'trend', 'weekOf'].sort(),
    );
    expect(Object.keys(payload.current).sort()).toEqual(
      [
        'boundHit',
        'deltaKcal',
        'effectiveDeficit',
        'macros',
        'prevTargetKcal',
        'projectedFinishDate',
        'targetKcal',
        'tdeeEst',
        'weeklyRateKg',
      ].sort(),
    );
  });

  it('derives prevTargetKcal/deltaKcal from the TARGET_CHANGED reason', () => {
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend);
    expect(payload.current.prevTargetKcal).toBe(2100);
    expect(payload.current.deltaKcal).toBe(-125);
  });

  it('falls back to a held target when there is no TARGET_CHANGED reason', () => {
    const payload = assembleCoachPayload(result({ reasons: [] }), adherence, goal, '2026-07-15', trend);
    expect(payload.current.prevTargetKcal).toBe(1975);
    expect(payload.current.deltaKcal).toBe(0);
  });

  it('derives loggedDays/windowDays from the adherence days array', () => {
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend);
    expect(payload.adherence.loggedDays).toBe(2);
    expect(payload.adherence.windowDays).toBe(3);
  });

  it('passes the trend series through as {date, trendKg} pairs', () => {
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend);
    expect(payload.trend).toEqual([{ date: '2026-07-01', trendKg: 95 }]);
  });
});

describe('assembleCoachPayload — Goals BRD §H.2 (goals/goalsAggregate)', () => {
  it('defaults to an empty goals payload when none is passed (the weekly-note trigger has no live Goals context)', () => {
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend);
    expect(payload.goals).toEqual([]);
    expect(payload.goalsAggregate).toEqual({ activeCount: 0, blockedCount: 0, completedThisWeekCount: 0 });
    expect(payload.goalSignals).toEqual([]);
  });

  it('derives goalsAggregate counts from the goals passed in', () => {
    const goals = [
      { externalId: 'g1', type: 'metric' as const, title: 'Lose 10kg', pct: 0.5, status: 'on_track' as const, daysUntilTargetDate: 90, blocked: false },
      { externalId: 'g2', type: 'fund' as const, title: 'House fund', pct: 1, status: 'completed' as const, daysUntilTargetDate: null, blocked: false },
      { externalId: 'g3', type: 'habit' as const, title: 'Read', pct: 0.2, status: 'blocked' as const, daysUntilTargetDate: null, blocked: true },
    ];
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend, goals);
    expect(payload.goals).toBe(goals);
    expect(payload.goalsAggregate).toEqual({ activeCount: 3, blockedCount: 1, completedThisWeekCount: 1 });
  });

  it('threads goalSignals through unchanged', () => {
    const goalSignals = [{ code: 'GOAL_COMPLETED' as const, goalExternalId: 'g2', title: 'House fund' }];
    const payload = assembleCoachPayload(result(), adherence, goal, '2026-07-15', trend, [], goalSignals);
    expect(payload.goalSignals).toBe(goalSignals);
  });
});
