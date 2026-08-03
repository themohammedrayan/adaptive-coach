// Finance coach's anti-hallucination guard — same isAllowed/allNumbersAllowed
// matching rules as numberGuard.ts, just walking a FinanceCoachPayload's
// numeric fields instead of a weight CoachPayload's.

import { allNumbersAllowed, isAllowed } from './numberGuard.ts';
import type { FinanceCoachPayload } from './financeTypes.ts';

export function collectAllowedNumbers(payload: FinanceCoachPayload): number[] {
  const nums: (number | null | undefined)[] = [
    payload.netWorthMinor,
    payload.month.incomeMinor,
    payload.month.expenseMinor,
  ];
  for (const c of payload.topExpenseCategories) nums.push(c.totalMinor);
  for (const a of payload.accounts) nums.push(a.balanceMinor);
  for (const g of payload.goals) nums.push(g.targetAmountMinor, g.savedMinor);
  for (const b of payload.budgets) nums.push(b.budgetedMinor, b.spentMinor);
  for (const p of payload.projection) nums.push(p.monthsAhead, p.projectedNetWorthMinor);
  nums.push(payload.cashflow.lowBalanceMinor, payload.cashflow.horizonDays);
  return nums.filter((n): n is number => typeof n === 'number');
}

export { allNumbersAllowed, isAllowed };
