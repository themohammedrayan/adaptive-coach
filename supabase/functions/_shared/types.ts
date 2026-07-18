// Deno-side duplicate of src/coaching/types.ts (this Edge Function is a
// separate deploy target and cannot import RN app source). Keep these two
// files in sync by hand — see src/coaching/types.ts for the sibling copy.

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

export interface CoachPayload {
  weekOf: IsoDate;
  goal: GoalSummary;
  current: CoachPayloadCurrent;
  trend: { date: IsoDate; trendKg: number }[];
  adherence: { loggedDays: number; windowDays: number; avgIntake: number; avgTarget: number };
  reasons: Reason[];
}

export interface CoachNoteContent {
  changeExplanation: string;
  weeklyReview: string;
  stallRead: string;
  suggestion: string;
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

/** v2 — ad-hoc coach Q&A storage shape (one row per turn). */
export interface CoachChatTurn extends ChatAnswerContent {
  id: string;
  question: string;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
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
