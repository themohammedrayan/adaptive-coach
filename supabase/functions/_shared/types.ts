// Deno-side duplicate of src/coaching/types.ts and src/coach-chat/types.ts
// (this Edge Function is a separate deploy target and cannot import RN app
// source). Keep these in sync by hand — see the RN-side files for the
// sibling copies. FinanceCoachPayload lives in financeTypes.ts, mirroring
// src/finance's coachPayload.ts.

import type { FinanceCoachPayload } from './financeTypes.ts';

export type IsoDate = string;

export type BoundHit = 'none' | 'lossRateCap' | 'calorieFloor' | 'moveLimit' | 'insufficientData';

export type Reason =
  | { code: 'TARGET_CHANGED'; from: number; to: number; deltaKcal: number }
  | { code: 'TREND_STALLED'; windowRateKg: number }
  | { code: 'BOUND_HIT'; bound: Exclude<BoundHit, 'none'> }
  | { code: 'INSUFFICIENT_DATA'; loggedDays: number; weighIns: number }
  | { code: 'COLD_START'; seedShare: number }
  | { code: 'MACRO_RECONCILED'; note: string };

export interface GoalSummary {
  startWeightKg: number;
  goalWeightKg: number;
  horizonDays: number;
  daysElapsed: number;
}

export interface CoachPayloadCurrent {
  targetKcal: number;
  prevTargetKcal: number;
  deltaKcal: number;
  macros: { proteinG: number; fatG: number; carbG: number; fiberG: number };
  tdeeEst: number | null;
  effectiveDeficit: number | null;
  weeklyRateKg: number | null;
  projectedFinishDate: IsoDate | null;
  boundHit: BoundHit;
}

export interface CoachGoalSummary {
  externalId: string;
  type: 'metric' | 'fund' | 'habit' | 'milestone';
  title: string;
  pct: number | null;
  status: 'on_track' | 'behind' | 'ahead' | 'blocked' | 'no_data' | 'completed';
  daysUntilTargetDate: number | null;
  blocked: boolean;
}

export interface CoachGoalsAggregate {
  activeCount: number;
  blockedCount: number;
  completedThisWeekCount: number;
}

export type GoalSignal =
  | { code: 'GOAL_COMPLETED'; goalExternalId: string; title: string }
  | { code: 'GOAL_BLOCKED'; goalExternalId: string; title: string; blockedByTitle: string }
  | { code: 'GOAL_DEADLINE_NEAR'; goalExternalId: string; title: string; daysLeft: number };

export interface CoachPayload {
  weekOf: IsoDate;
  goal: GoalSummary;
  current: CoachPayloadCurrent;
  trend: { date: IsoDate; trendKg: number }[];
  adherence: { loggedDays: number; windowDays: number; avgIntake: number; avgTarget: number };
  reasons: Reason[];
  goals: CoachGoalSummary[];
  goalsAggregate: CoachGoalsAggregate;
  goalSignals: GoalSignal[];
}

export interface CoachNoteContent {
  changeExplanation: string;
  weeklyReview: string;
  stallRead: string;
  suggestion: string;
  goalsNote: string;
}

export interface CoachNote extends CoachNoteContent {
  id: string;
  weekOf: IsoDate;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
}

export interface ChatAnswerContent {
  answer: string;
}

/** v2 — ad-hoc coach Q&A storage shape (one row per turn). Domain-generic — coach-unification merged the health/finance turn tables into one. */
export interface CoachChatTurn extends ChatAnswerContent {
  id: string;
  question: string;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
}

/**
 * Coach-unification — the merged ad-hoc Q&A grounding payload, replacing
 * separately-passed CoachPayload/FinanceCoachPayload. `health` is null
 * when there's no primary weight goal with a live EngineResult yet;
 * `finance` is always buildable. See src/coach-chat/types.ts for the
 * RN-side sibling and its fuller rationale.
 */
export interface UnifiedCoachPayload {
  today: IsoDate;
  health: CoachPayload | null;
  finance: FinanceCoachPayload;
  goals: CoachGoalSummary[];
  goalsAggregate: CoachGoalsAggregate;
  goalSignals: GoalSignal[];
}

/** v2 — the raw shape the model is asked to produce (before server-side kcal derivation). */
export interface RawMealEstimate {
  name: string;
  proteinPer100g: number | null;
  carbPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  estimatedGrams: number | null;
  confidence: 'low' | 'medium' | 'high';
}

/** v2 — AI meal estimation response. Ephemeral, never persisted server-side. */
export interface MealEstimate extends RawMealEstimate {
  /**
   * Server-derived as 4*protein + 4*carb + 9*fat — never trusted from the
   * model. Null when protein/carb/fat aren't all known (nothing to derive
   * from — the model is never asked for kcal directly), mirroring Food's
   * own kcal-only shape: the review form asks the user to type calories,
   * exactly like manual "kcal only" entry already does.
   */
  kcalPer100g: number | null;
  macrosComplete: boolean;
  source: 'model';
  model: string;
}
