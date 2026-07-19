import { createChallenge } from '../challenges';
import type { Challenge, ChallengeStore } from '../challenges';
import type { Goal, GoalType, Habit, HabitLogEntry, MilestoneItem, SourceBinding } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface BuildGoalInput {
  type: GoalType;
  title: string;
  sourceBinding: SourceBinding;
  priority?: number;
  blockedByGoalId?: string | null;
  targetDate?: string | null;
}

export function buildGoal(input: BuildGoalInput, nowIso: string, genId: IdGenerator = defaultGenId): Goal {
  const id = genId();
  return {
    id,
    externalId: id,
    type: input.type,
    title: input.title,
    status: 'active',
    priority: input.priority ?? 0,
    blockedByGoalId: input.blockedByGoalId ?? null,
    sourceBinding: input.sourceBinding,
    targetDate: input.targetDate ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export interface BuildHabitInput {
  name: string;
  targetCount: number;
  windowDays: number;
}

export function buildHabit(input: BuildHabitInput, nowIso: string, genId: IdGenerator = defaultGenId): Habit {
  const id = genId();
  return {
    id,
    externalId: id,
    name: input.name,
    cadenceKind: 'count_per_window',
    targetCount: input.targetCount,
    windowDays: input.windowDays,
    archivedAt: null,
    updatedAt: nowIso,
  };
}

/**
 * Upsert-or-remove for the check-in toggle: `null` means "already checked in
 * today, clear it" (caller deletes the row); otherwise builds the entry for
 * today. At most one entry per habit per day (DB unique constraint on
 * habitExternalId+occurredOn).
 */
export function toggleHabitLogEntry(
  habitExternalId: string,
  occurredOn: string,
  existing: HabitLogEntry | null,
  nowIso: string,
  genId: IdGenerator = defaultGenId,
): HabitLogEntry | null {
  if (existing !== null) return null;
  const id = genId();
  return {
    id,
    externalId: id,
    habitExternalId,
    occurredOn,
    note: null,
    source: 'manual',
    updatedAt: nowIso,
  };
}

export interface BuildMilestoneItemInput {
  goalExternalId: string;
  title: string;
  sortOrder: number;
}

export function buildMilestoneItem(
  input: BuildMilestoneItemInput,
  nowIso: string,
  genId: IdGenerator = defaultGenId,
): MilestoneItem {
  const id = genId();
  return {
    id,
    externalId: id,
    goalExternalId: input.goalExternalId,
    title: input.title,
    sortOrder: input.sortOrder,
    checkedAt: null,
    updatedAt: nowIso,
  };
}

export function toggleMilestoneItem(item: MilestoneItem, nowIso: string): MilestoneItem {
  return { ...item, checkedAt: item.checkedAt === null ? nowIso : null, updatedAt: nowIso };
}

export interface CreateMetricGoalInput {
  title: string;
  goalWeightKg: number;
  startWeightKg: number;
  horizonDays: number;
  priority?: number;
}

/**
 * The one path metric goals are created through — onboarding
 * (ProfileSetupScreen) and Create Goal's metric branch both call this
 * instead of createChallenge() directly, so a metric goal is never left
 * unwrapped. Not a pure builder like the others above: it actually persists
 * the Challenge (via the unchanged createChallenge()) since the wrapping
 * Goal's sourceBinding needs a real challenge id to point at. The returned
 * `goal` still isn't persisted here — the caller upserts it via
 * src/goals/api.ts, same as every other Goal row.
 */
export async function createMetricGoal(
  challengeStore: ChallengeStore,
  input: CreateMetricGoalInput,
  nowUtc: string,
  startDate: string,
  genId: IdGenerator = defaultGenId,
): Promise<{ challenge: Challenge; goal: Goal }> {
  const challenge = await createChallenge(
    challengeStore,
    {
      domain: 'weight',
      goalWeightKg: input.goalWeightKg,
      startWeightKg: input.startWeightKg,
      horizonDays: input.horizonDays,
    },
    nowUtc,
    startDate,
    genId,
  );
  const goal = buildGoal(
    {
      type: 'metric',
      title: input.title,
      sourceBinding: { type: 'metric', challengeId: challenge.id },
      priority: input.priority,
    },
    nowUtc,
    genId,
  );
  return { challenge, goal };
}
