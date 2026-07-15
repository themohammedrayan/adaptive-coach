import { mergeConfig } from './constants';
import { addDays, diffDays } from './dates';
import { splitMacros } from './macros';
import { computeTarget, projectFinish, requiredBalance } from './target';
import { coldStartBlend, estimateTDEE, rmrMifflinStJeor } from './tdee';
import { computeTrend, trendAt, weeklyRate } from './trend';
import type {
  DayLog,
  EngineConfig,
  EngineResult,
  EngineState,
  IsoDate,
  Measurement,
  Profile,
  Reason,
} from './types';

export interface RecomputeOptions {
  /** Bypass the weekly recompute gate (on-demand trigger). */
  force?: boolean;
}

/**
 * Engine BRD §5.8 — the weekly recompute. Pure: `today` and all data are
 * parameters; nothing is read from the environment.
 *
 * Returns null when the recompute interval hasn't elapsed (no-op).
 * The insufficient-data hold only applies when a previous target exists;
 * the first run always computes via the cold-start blend.
 */
export function recompute(
  state: EngineState,
  profile: Profile,
  measurements: Measurement[],
  logs: DayLog[],
  today: IsoDate,
  configOverrides?: Partial<EngineConfig>,
  opts?: RecomputeOptions,
): EngineResult | null {
  const cfg = mergeConfig(configOverrides);

  if (
    !opts?.force &&
    state.lastRecomputeDate !== null &&
    diffDays(today, state.lastRecomputeDate) < cfg.recomputeIntervalDays
  ) {
    return null;
  }

  const trend = computeTrend(measurements, { end: today }, cfg.ewmaHalfLifeDays);
  const trendWeightKg = trendAt(trend, today) ?? state.startWeightKg;
  const weeklyRateKg = weeklyRate(trend, today);

  const windowStart = addDays(today, -(cfg.windowDays - 1));
  const inWindow = (date: IsoDate) =>
    diffDays(date, windowStart) >= 0 && diffDays(date, today) <= 0;
  const windowLogs = logs.filter((l) => l.logged && inWindow(l.date));
  const loggedDays = new Set(windowLogs.map((l) => l.date)).size;
  const weighIns = new Set(measurements.filter((m) => inWindow(m.date)).map((m) => m.date)).size;
  const dataDays = Math.min(loggedDays, weighIns);

  const insufficient = loggedDays < cfg.minLoggedDays || weighIns < cfg.minWeighIns;

  // Hold path: not enough data to trust a recompute, but a target exists to hold.
  if (insufficient && state.prevTargetKcal !== null) {
    const held = state.prevTargetKcal;
    const { macros, warning } = splitMacros(held, trendWeightKg, cfg);
    return {
      targetKcal: held,
      macros,
      macroWarning: warning,
      tdeeEst: null,
      tdeeUsed: null,
      energyBalancePerDay: null,
      effectiveDeficit: null,
      projectedFinishDate: null,
      trendWeightKg,
      weeklyRateKg,
      boundHit: 'insufficientData',
      dataStatus: { loggedDays, weighIns, coldStartWeight: 1 - dataDays / cfg.windowDays },
      reasons: [
        { code: 'INSUFFICIENT_DATA', loggedDays, weighIns },
        { code: 'BOUND_HIT', bound: 'insufficientData' },
      ],
    };
  }

  // Full compute (§5.1–5.7).
  const windowTrendStart = trendAt(trend, windowStart) ?? trend[0]?.trendKg ?? null;
  const tdeeEst = estimateTDEE(
    {
      logs: windowLogs,
      trendStartKg: windowTrendStart,
      trendEndKg: trend.length > 0 ? trendWeightKg : null,
      windowDays: cfg.windowDays,
    },
    cfg,
  );
  const { tdeeUsed, seedShare } = coldStartBlend(tdeeEst, profile, trendWeightKg, dataDays, cfg);

  const calorieFloor =
    cfg.calorieFloorKcal ??
    Math.max(cfg.calorieFloorMinKcal, rmrMifflinStJeor(profile, trendWeightKg));

  const daysElapsed = Math.max(0, diffDays(today, profile.startDate));
  const daysRemaining = Math.max(1, profile.horizonDays - daysElapsed);
  const reqBalance = requiredBalance(
    trendWeightKg,
    profile.goalWeightKg,
    daysRemaining,
    cfg.kcalPerKg,
  );

  const t = computeTarget(tdeeUsed, reqBalance, trendWeightKg, state.prevTargetKcal, calorieFloor, cfg);
  const { macros, warning } = splitMacros(t.targetKcal, trendWeightKg, cfg);
  const projectedFinishDate = projectFinish(
    trendWeightKg,
    profile.goalWeightKg,
    t.effectiveDeficit,
    today,
    cfg.kcalPerKg,
  );

  const reasons: Reason[] = [];
  if (state.prevTargetKcal !== null && t.targetKcal !== state.prevTargetKcal) {
    reasons.push({
      code: 'TARGET_CHANGED',
      from: state.prevTargetKcal,
      to: t.targetKcal,
      deltaKcal: t.targetKcal - state.prevTargetKcal,
    });
  }
  const windowRateKg =
    windowTrendStart !== null && trend.length > 0 ? trendWeightKg - windowTrendStart : null;
  if (
    profile.mode === 'lose' &&
    windowRateKg !== null &&
    weighIns >= cfg.minWeighIns &&
    windowRateKg > -cfg.stallThresholdKgPerWindow
  ) {
    reasons.push({ code: 'TREND_STALLED', windowRateKg });
  }
  if (t.boundHit !== 'none') {
    reasons.push({ code: 'BOUND_HIT', bound: t.boundHit });
  }
  if (seedShare > 0) {
    reasons.push({ code: 'COLD_START', seedShare });
  }
  if (warning !== null) {
    reasons.push({ code: 'MACRO_RECONCILED', note: warning });
  }

  return {
    targetKcal: t.targetKcal,
    macros,
    macroWarning: warning,
    tdeeEst,
    tdeeUsed,
    energyBalancePerDay: reqBalance,
    effectiveDeficit: t.effectiveDeficit,
    projectedFinishDate,
    trendWeightKg,
    weeklyRateKg,
    boundHit: t.boundHit,
    dataStatus: { loggedDays, weighIns, coldStartWeight: seedShare },
    reasons,
  };
}

/** The EngineState to persist after a successful recompute (caller owns storage). */
export function nextEngineState(
  prev: EngineState,
  result: EngineResult,
  today: IsoDate,
): EngineState {
  return {
    prevTargetKcal: result.targetKcal,
    mode: prev.mode,
    lastRecomputeDate: today,
    startWeightKg: prev.startWeightKg,
  };
}
