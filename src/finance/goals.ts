import { addDays, type IsoDate } from '../engine';
import { clampDayOfMonth } from './recurrenceDates';
import type { FinanceGoal, MoneyMinor, RecurrenceFrequency } from './types';

export interface FinanceGoalProgress {
  savedMinor: number;
  pct: number;
  remainingMinor: number;
}

/** Progress is always read from the linked account's live balance — a goal never stores its own "saved so far" figure. */
export function financeGoalProgress(goal: FinanceGoal, accountBalanceMinor: number): FinanceGoalProgress {
  const savedMinor = Math.max(0, accountBalanceMinor);
  const pct = goal.targetAmountMinor > 0 ? savedMinor / goal.targetAmountMinor : 0;
  const remainingMinor = Math.max(0, goal.targetAmountMinor - savedMinor);
  return { savedMinor, pct, remainingMinor };
}

export interface ContributionOutlook {
  /** Contributions still needed to reach the target. 0 once it's met. */
  paymentsLeft: number;
  /** When the last of those lands. Equals `today` when the goal is already met. */
  projectedCompletionDate: IsoDate;
  /** Whether the plan lands on or before the goal's target date. Null when it has no target date. */
  onTrackForTargetDate: boolean | null;
}

/** A goal that funds itself in more steps than this is effectively never finishing. */
const MAX_PROJECTED_PAYMENTS = 1200;

/** `today` advanced by `steps` of the given cadence, clamping day-of-month for short months. */
function advanceByCadence(today: IsoDate, cadence: RecurrenceFrequency, steps: number): IsoDate {
  if (cadence === 'daily') return addDays(today, steps);
  if (cadence === 'weekly') return addDays(today, steps * 7);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const totalIndex = month - 1 + steps;
  return clampDayOfMonth(year + Math.floor(totalIndex / 12), (((totalIndex % 12) + 12) % 12) + 1, day);
}

/**
 * What the goal's own contribution plan implies: how many more payments, and
 * when the last one lands.
 *
 * Null when there's no plan to reason from — the caller then falls back to the
 * calendar-elapsed read, rather than inventing a schedule the user never set.
 */
export function contributionOutlook(
  goal: FinanceGoal,
  savedMinor: MoneyMinor,
  today: IsoDate,
): ContributionOutlook | null {
  const amount = goal.contributionAmountMinor;
  const cadence = goal.contributionCadence;
  if (amount === null || cadence === null || amount <= 0) return null;

  const remainingMinor = Math.max(0, goal.targetAmountMinor - Math.max(0, savedMinor));
  const paymentsLeft = Math.min(Math.ceil(remainingMinor / amount), MAX_PROJECTED_PAYMENTS);
  const projectedCompletionDate = advanceByCadence(today, cadence, paymentsLeft);

  return {
    paymentsLeft,
    projectedCompletionDate,
    onTrackForTargetDate: goal.targetDate === null ? null : projectedCompletionDate <= goal.targetDate,
  };
}
