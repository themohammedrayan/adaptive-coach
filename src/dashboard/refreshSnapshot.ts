import { assembleCoachPayload, buildGoalSummary, generateCoachNote } from '../coaching';
import { buildMeasurementSeries } from '../data-sync';
import type { BodyMetricsStore } from '../data-sync';
import { addDays, computeTrend, dateRange, DEFAULT_CONFIG, nextEngineState, recompute } from '../engine';
import type { IsoDate } from '../engine';
import { dailyTotals, toDayLog } from '../food-log';
import type { FoodLogStore } from '../food-log';
import { buildAdherenceSummary } from './adherence';
import { notifyCoachNoteReady } from './reminders';
import type { DashboardStore } from './store';
import type { DashboardSnapshot } from './types';

export interface RefreshDeps {
  dashboardStore: DashboardStore;
  foodLogStore: FoodLogStore;
  dataSyncStore: BodyMetricsStore;
}

/**
 * Dashboard BRD §A1 — the engine glue/orchestrator (the module's one
 * deliberate exception to "no new business logic", user-approved). Gathers
 * Measurement[] from Data-Sync and DayLog[] from Food-Log, calls the
 * Engine's recompute, persists the result when it advances, and falls
 * back to the cached previous result when the recompute gate hasn't
 * elapsed (recompute returns null — held display continuity).
 *
 * Stores are injected (not fetched via getXRuntime() internally), matching
 * the dependency-injection convention `data-sync/sync.ts`'s syncOnOpen(deps,
 * ...) already established — keeps this testable with MemoryStores, no
 * Platform/singleton coupling in tests. The caller (DashboardScreen) wires
 * the real runtimes.
 */
export async function refreshDashboardSnapshot(
  deps: RefreshDeps,
  today: IsoDate,
  opts?: { force?: boolean },
): Promise<DashboardSnapshot> {
  const { dashboardStore: dashStore, foodLogStore: foodStore, dataSyncStore } = deps;
  const profile = await dashStore.getProfile();
  if (profile === null) {
    return { profile: null, engineState: null, result: null, resultComputedAt: null, last14: [] };
  }
  const engineState = await dashStore.getEngineState();
  if (engineState === null) {
    return { profile, engineState: null, result: null, resultComputedAt: null, last14: [] };
  }

  const last14 = await Promise.all(
    dateRange(addDays(today, -13), today).map((date) => dailyTotals(foodStore, date)),
  );

  const range = { start: profile.startDate, end: today };
  const weightRows = await dataSyncStore.listByType('weight', range);
  const measurements = buildMeasurementSeries(weightRows, range, 'earliest');

  const result = recompute(engineState, profile, measurements, last14.map(toDayLog), today, undefined, {
    force: opts?.force,
  });

  if (result !== null) {
    const next = nextEngineState(engineState, result, today);
    await dashStore.setEngineState(next);
    await dashStore.setLastResult(today, result);
    // Recompute→coach note→reminder wiring (BRD §B2.3): fire-and-forget, never blocks the snapshot.
    // The Edge Function already resolves API failures to a fallback note server-side; this
    // .catch only guards transport-level failures (offline device, function unreachable).
    const trend = computeTrend(measurements, { start: addDays(today, -13), end: today }, DEFAULT_CONFIG.ewmaHalfLifeDays);
    const adherenceSummary = buildAdherenceSummary(last14, result.targetKcal);
    const goal = buildGoalSummary(profile, next, today);
    const payload = assembleCoachPayload(result, adherenceSummary, goal, today, trend);
    void generateCoachNote(payload)
      .then((note) => notifyCoachNoteReady(note))
      .catch((e) => console.warn('[coaching] note generation failed (will retry next recompute):', e));
    return { profile, engineState: next, result, resultComputedAt: today, last14 };
  }

  const cached = await dashStore.getLastResult();
  return {
    profile,
    engineState,
    result: cached?.result ?? null,
    resultComputedAt: cached?.computedAt ?? null,
    last14,
  };
}
