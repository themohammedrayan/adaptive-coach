import { categoryBreakdown } from './categoryTotals';
import type { Budget, Category, Transaction } from './types';

export interface BudgetProgress {
  categoryExternalId: string | null;
  budgetedMinor: number;
  spentMinor: number;
  pct: number;
  remainingMinor: number;
}

/** Progress for every active (non-archived) budget — null category is the overall monthly cap. */
export function budgetProgress(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  monthPrefix: string,
): BudgetProgress[] {
  const breakdown = categoryBreakdown(transactions, categories, monthPrefix, 'expense');
  const overallSpentMinor = breakdown.reduce((sum, c) => sum + c.totalMinor, 0);

  return budgets
    .filter((b) => b.archivedAt === null)
    .map((b) => {
      const spentMinor =
        b.categoryExternalId === null
          ? overallSpentMinor
          : (breakdown.find((c) => c.categoryExternalId === b.categoryExternalId)?.totalMinor ?? 0);
      const pct = b.amountMinor > 0 ? spentMinor / b.amountMinor : 0;
      const remainingMinor = Math.max(0, b.amountMinor - spentMinor);
      return { categoryExternalId: b.categoryExternalId, budgetedMinor: b.amountMinor, spentMinor, pct, remainingMinor };
    });
}
