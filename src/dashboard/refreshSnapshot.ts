import { toEngineProfile, toEngineState, withEngineState } from '../challenges';
import type { ChallengeStore } from '../challenges';
import { assembleCoachPayload, buildGoalSummary, gatherPayloadInputs, generateCoachNote } from '../coaching';
import type { BodyMetricsStore } from '../data-sync';
import { computeTrend, DEFAULT_CONFIG, nextEngineState, recompute, trendAt } from '../engine';
import type { IsoDate } from '../engine';
import { toDayLog } from '../food-log';
import type { FoodLogStore } from '../food-log';
import { buildAdherenceSummary } from './adherence';
import { notifyCoachNoteReady } from './reminders';
import type { DashboardStore } from './store';
import type { DashboardSnapshot } from './types';

export interface RefreshDeps {
  dashboardStore: DashboardStore;
  foodLogStore: FoodLogStore;
  dataSyncStore: BodyMetricsStore;
  challengeStore: ChallengeStore;
  /** Clock for the challenge's updatedAt stamp (cross-device LWW); defaults to the device clock. */
  nowUtc?: () => string;
}

/**
 * Dashboard BRD §A1 — the engine glue/orchestrator (the module's one
 * deliberate exception to "no new business logic", user-approved). Gathers
 * Measurement[] from Data-Sync and DayLog[] from Food-Log, calls the
 * Engine's recompute, persists the result when it advances, and falls
 * back to the cached previous result when the recompute gate hasn't
 * elapsed (recompute returns null — held display continuity).
 *
 * The engine's Profile/EngineState are built on the fly from the stored
 * bio-only Profile plus the primary weight Challenge (src/challenges) —
 * the engine module itself is untouched; this is the one adapter seam.
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
  const { dashboardStore: dashStore, foodLogStore: foodStore, dataSyncStore, challengeStore } = deps;
  const profile = await dashStore.getProfile();
  if (profile === null) {
    return {
      profile: null,
      primaryChallenge: null,
      result: null,
      resultComputedAt: null,
      last14: [],
      liveTrendWeightKg: null,
    };
  }
  const primary = await challengeStore.getPrimary('weight');
  if (primary === null) {
    // No active challenge to prescribe against (e.g. paused/deleted the only one) —
    // same empty-result shape as the profile===null branch above.
    return {
      profile,
      primaryChallenge: null,
      result: null,
      resultComputedAt: null,
      last14: [],
      liveTrendWeightKg: null,
    };
  }

  const engineProfile = toEngineProfile(profile, primary);
  const engineState = toEngineState(primary);

  const { last14, measurements, trend } = await gatherPayloadInputs(
    { foodLogStore: foodStore, dataSyncStore },
    engineProfile,
    today,
  );

  // Independent of the weekly recompute gate below — the Challenge card's kcal-banked
  // figure should move the day a new weigh-in lands, even on weeks the engine holds the
  // cached target/macros steady (BRD-intended noise damping we don't want to touch).
  const liveTrend = computeTrend(measurements, { end: today }, DEFAULT_CONFIG.ewmaHalfLifeDays);
  const liveTrendWeightKg = trendAt(liveTrend, today) ?? engineState.startWeightKg;

  const result = recompute(engineState, engineProfile, measurements, last14.map(toDayLog), today, undefined, {
    force: opts?.force,
  });

  if (result !== null) {
    const next = nextEngineState(engineState, result, today);
    const updatedChallenge = withEngineState(primary, next, deps.nowUtc?.() ?? new Date().toISOString());
    await challengeStore.upsert(updatedChallenge);
    await dashStore.setLastResult(today, result);
    // Recompute→coach note→reminder wiring (BRD §B2.3): fire-and-forget, never blocks the snapshot.
    // The Edge Function already resolves API failures to a fallback note server-side; this
    // .catch only guards transport-level failures (offline device, function unreachable).
    const adherenceSummary = buildAdherenceSummary(last14, result.targetKcal);
    const goal = buildGoalSummary(
      updatedChallenge.startWeightKg,
      updatedChallenge.goalWeightKg,
      updatedChallenge.horizonDays,
      updatedChallenge.startDate,
      today,
    );
    const payload = assembleCoachPayload(result, adherenceSummary, goal, today, trend);
    void generateCoachNote(payload)
      .then((note) => notifyCoachNoteReady(note))
      .catch((e) => console.warn('[coaching] note generation failed (will retry next recompute):', e));
    return {
      profile,
      primaryChallenge: updatedChallenge,
      result,
      resultComputedAt: today,
      last14,
      liveTrendWeightKg,
    };
  }

  const cached = await dashStore.getLastResult();
  return {
    profile,
    primaryChallenge: primary,
    result: cached?.result ?? null,
    resultComputedAt: cached?.computedAt ?? null,
    last14,
    liveTrendWeightKg,
  };
}
