import type { Challenge, ChallengeStore } from '../challenges';
import type { BoundHit, IsoDate, Measurement } from '../engine';
import type { FinanceGoal } from '../finance/types';

export type GoalType = 'metric' | 'fund' | 'habit' | 'milestone';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export type ProgressStatus = 'on_track' | 'behind' | 'ahead' | 'blocked' | 'no_data' | 'completed';

/** Discriminated by `.type` — where a goal's progress is actually read from. */
export type SourceBinding =
  | { type: 'metric'; challengeId: string }
  | { type: 'fund'; financeGoalExternalId: string }
  | { type: 'habit'; habitExternalId: string }
  | { type: 'milestone' };

/** Goals BRD §D.1/§C.1. Stores *what* to track and *where* to look — never *how far along* it is (§B.1). */
export interface Goal {
  id: string;
  externalId: string;
  type: GoalType;
  title: string;
  status: GoalStatus;
  priority: number;
  blockedByGoalId: string | null;
  sourceBinding: SourceBinding;
  targetDate: IsoDate | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  /** 0..1 clamped; null = no_data. */
  pct: number | null;
  status: ProgressStatus;
  numerator: number | null;
  denominator: number | null;
  asOf: IsoDate;
  /** Feeds the coach's number allowlist (§H.4) — resolver-specific extra figures. */
  detail: Record<string, number | string | boolean | null>;
}

export type GoalResolver = (goal: Goal, ctx: ResolverContext) => Promise<GoalProgress>;

/** Goals BRD §F.1. `cadence_kind` has exactly one value in v1. */
export interface Habit {
  id: string;
  externalId: string;
  name: string;
  cadenceKind: 'count_per_window';
  targetCount: number;
  windowDays: number;
  archivedAt: string | null;
  updatedAt: string;
}

/** Goals BRD §F.2. At most one row per habit per day (unique on habitExternalId+occurredOn). */
export interface HabitLogEntry {
  id: string;
  externalId: string;
  habitExternalId: string;
  occurredOn: IsoDate;
  note: string | null;
  source: 'manual';
  updatedAt: string;
}

/** Goals BRD §D.1 (`goal_milestone_items`). Flat, ordered checklist — no sub-tasks in v1. */
export interface MilestoneItem {
  id: string;
  externalId: string;
  goalExternalId: string;
  title: string;
  sortOrder: number;
  checkedAt: string | null;
  updatedAt: string;
}

/**
 * Goals BRD §C.1 — dependency-injected bundle of per-type read lookups,
 * mirroring the `RefreshDeps` pattern in `src/dashboard/refreshSnapshot.ts`.
 * Resolvers never reach for a runtime singleton themselves. These are narrow
 * read-only interfaces, not full CRUD stores — there's no local storage
 * engine to swap between for the Supabase-backed types (see `src/goals/api.ts`).
 */
export interface ResolverContext {
  today: IsoDate;
  challengeStore: ChallengeStore;
  measurements: Measurement[];
  /**
   * Only the primary weight Challenge has a live EngineResult — a
   * non-primary challenge returns null here (it has no prescription of its
   * own, per `src/dashboard/challenge.ts`'s comment on `buildChallengeProgress`).
   */
  lastEngineResult: (challenge: Challenge) => { boundHit: BoundHit; projectedFinishDate: IsoDate | null } | null;
  financeGoalStore: { getByExternalId(externalId: string): Promise<FinanceGoal | null> };
  accountBalanceAsOf: (accountExternalId: string, asOfDate: IsoDate) => number | null;
  habitStore: { getByExternalId(externalId: string): Promise<Habit | null> };
  habitLogStore: { countInRange(habitExternalId: string, startDate: IsoDate, endDate: IsoDate): Promise<number> };
  milestoneItemStore: { listByGoal(goalExternalId: string): Promise<MilestoneItem[]> };
}
