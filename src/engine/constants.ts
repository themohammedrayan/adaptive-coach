import type { EngineConfig } from './types';

/** Engine BRD §3 defaults. Every value is overridable per call via Partial<EngineConfig>. */
export const DEFAULT_CONFIG: EngineConfig = {
  windowDays: 14,
  ewmaHalfLifeDays: 10,
  kcalPerKg: 7700,
  minLoggedDays: 8,
  minWeighIns: 8,
  maxLossRateFrac: 0.01,
  moveLimitKcal: 125,
  calorieFloorKcal: null, // null → max(calorieFloorMinKcal, RMR)
  calorieFloorMinKcal: 1500,
  recomputeIntervalDays: 7,
  proteinGPerKg: 1.8,
  fatGPerKgFloor: 0.6,
  fatMinPct: 0.2,
  fiberGPer1000Kcal: 14,
  carbMinG: 50,
  stallThresholdKgPerWindow: 0.1,
};

export function mergeConfig(overrides?: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
