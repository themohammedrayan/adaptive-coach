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
