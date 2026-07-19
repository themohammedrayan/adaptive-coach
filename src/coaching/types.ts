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

/** Goals BRD §H.2 — a capped, narration-ready summary of one resolved goal. */
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

/**
 * Goals BRD §H.3 — coaching-owned signal union, carried parallel to (never
 * merged into) Engine's `Reason` union, which stays engine-internal only
 * (§B.3). The coach narrates these; it never recomputes anything from them.
 */
export type GoalSignal =
  | { code: 'GOAL_COMPLETED'; goalExternalId: string; title: string }
  | { code: 'GOAL_BLOCKED'; goalExternalId: string; title: string; blockedByTitle: string }
  | { code: 'GOAL_DEADLINE_NEAR'; goalExternalId: string; title: string; daysLeft: number };

/** Coaching BRD §4 — the grounding payload contract. Aggregates only, no raw entries/PII. */
export interface CoachPayload {
  weekOf: IsoDate;
  goal: GoalSummary;
  current: CoachPayloadCurrent;
  trend: { date: IsoDate; trendKg: number }[];
  adherence: { loggedDays: number; windowDays: number; avgIntake: number; avgTarget: number };
  reasons: Reason[];
  /** Goals BRD §H.2 — capped, e.g. top 10 by priority ascending, then updatedAt descending. */
  goals: CoachGoalSummary[];
  goalsAggregate: CoachGoalsAggregate;
  goalSignals: GoalSignal[];
}

export interface CoachNoteContent {
  changeExplanation: string;
  weeklyReview: string;
  stallRead: string;
  suggestion: string;
  /** Goals BRD §H.4 — narrates goalSignals/goalsAggregate; empty string when there are no active goals to report on. */
  goalsNote: string;
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
