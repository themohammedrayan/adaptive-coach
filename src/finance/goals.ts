import type { FinanceGoal } from './types';

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
