import type { BoundHit, IsoDate, Reason } from '../engine';

export interface GoalSummary {
  startWeightKg: number;
  goalWeightKg: number;
  horizonDays: number;
  daysElapsed: number;
}

/**
 * Structurally compatible with dashboard's AdherenceSummary/DayStatus —
 * NOT imported from '../dashboard' (would create a circular import:
 * this module is triggered from dashboard/refreshSnapshot.ts). TS
 * structural typing makes the dashboard value assignable here anyway.
 */
export interface AdherenceInput {
  days: { date: IsoDate; logged: boolean }[];
  avgIntake: number;
  avgTarget: number;
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

/** Coaching BRD §4 — the grounding payload contract. Aggregates only, no raw entries/PII. */
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

/** Coaching BRD §8 — storage shape. */
export interface CoachNote extends CoachNoteContent {
  id: string;
  weekOf: IsoDate;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
}
