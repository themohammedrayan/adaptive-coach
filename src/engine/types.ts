/** Calendar date as 'YYYY-MM-DD'. All engine date math is calendar-day based. */
export type IsoDate = string;

export type Mode = 'lose' | 'maintain' | 'gain';

export type Source = 'manual' | 'health_connect';

export interface Profile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  /** Activity multiplier applied to RMR for the cold-start seed (e.g. 1.2–1.9). */
  activityFactor: number;
  goalWeightKg: number;
  horizonDays: number;
  startDate: IsoDate;
  mode: Mode;
}

/** One raw weigh-in. Upstream (Data-Sync) guarantees at most one per day. */
export interface Measurement {
  date: IsoDate;
  weightKg: number;
  source: Source;
}

/** One day's food-log rollup, as produced by the Food-Log module. */
export interface DayLog {
  date: IsoDate;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  logged: boolean;
}

export interface EngineState {
  prevTargetKcal: number | null;
  mode: Mode;
  lastRecomputeDate: IsoDate | null;
  startWeightKg: number;
}

export interface Macros {
  proteinG: number;
  fatG: number;
  carbG: number;
  /** Constraint only — never part of the kcal sum. */
  fiberG: number;
}

export type BoundHit =
  | 'none'
  | 'lossRateCap'
  | 'calorieFloor'
  | 'moveLimit'
  | 'insufficientData';

export interface TrendPoint {
  date: IsoDate;
  rawKg: number | null;
  trendKg: number;
}

/** Machine-readable change explanations. The coach narrates these; it never recomputes. */
export type Reason =
  | { code: 'TARGET_CHANGED'; from: number; to: number; deltaKcal: number }
  | { code: 'TREND_STALLED'; windowRateKg: number }
  | { code: 'BOUND_HIT'; bound: Exclude<BoundHit, 'none'> }
  | { code: 'INSUFFICIENT_DATA'; loggedDays: number; weighIns: number }
  | { code: 'COLD_START'; seedShare: number }
  | { code: 'MACRO_RECONCILED'; note: string };

export interface EngineConfig {
  windowDays: number;
  ewmaHalfLifeDays: number;
  kcalPerKg: number;
  minLoggedDays: number;
  minWeighIns: number;
  /** Max loss per week as a fraction of bodyweight. */
  maxLossRateFrac: number;
  moveLimitKcal: number;
  /** Explicit floor; when null the floor is max(calorieFloorMinKcal, RMR). */
  calorieFloorKcal: number | null;
  calorieFloorMinKcal: number;
  recomputeIntervalDays: number;
  proteinGPerKg: number;
  fatGPerKgFloor: number;
  fatMinPct: number;
  fiberGPer1000Kcal: number;
  carbMinG: number;
  /** |Δtrend| over the window below which the trend counts as stalled (kg). */
  stallThresholdKgPerWindow: number;
}

export interface EngineResult {
  targetKcal: number;
  macros: Macros;
  macroWarning: string | null;
  /** Data-driven TDEE estimate; null when it can't be computed (no logs / no trend). */
  tdeeEst: number | null;
  /** TDEE actually used (cold-start blend of seed + estimate); null only on an insufficient-data hold. */
  tdeeUsed: number | null;
  /** Required signed energy balance per day to hit the goal (negative = deficit). */
  energyBalancePerDay: number | null;
  /** tdeeUsed − target: what the prescription actually achieves (> 0 = losing). */
  effectiveDeficit: number | null;
  projectedFinishDate: IsoDate | null;
  trendWeightKg: number;
  weeklyRateKg: number | null;
  boundHit: BoundHit;
  dataStatus: {
    loggedDays: number;
    weighIns: number;
    /** Share of tdeeUsed coming from the formula seed: 1 = all seed, 0 = all data. */
    coldStartWeight: number;
  };
  reasons: Reason[];
}
