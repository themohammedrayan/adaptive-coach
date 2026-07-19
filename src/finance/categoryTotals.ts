import type { Category, CategoryKind, Transaction } from './types';

export interface CategoryTotal {
  categoryExternalId: string;
  categoryName: string;
  totalMinor: number;
}

/** Totals by category for one kind within a given month, sorted largest first. Transfers/adjustments are never `kind`, so they're excluded automatically. */
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  monthPrefix: string,
  kind: CategoryKind,
): CategoryTotal[] {
  const categoryByExternalId = new Map(categories.map((c) => [c.externalId, c]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== kind || t.categoryExternalId === null || !t.txnDate.startsWith(monthPrefix)) continue;
    totals.set(t.categoryExternalId, (totals.get(t.categoryExternalId) ?? 0) + t.amountMinor);
  }
  return Array.from(totals.entries())
    .map(([categoryExternalId, totalMinor]) => ({
      categoryExternalId,
      categoryName: categoryByExternalId.get(categoryExternalId)?.name ?? 'Unknown',
      totalMinor,
    }))
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export interface MonthTotals {
  /** 'YYYY-MM' */
  month: string;
  incomeMinor: number;
  expenseMinor: number;
}

/** Income vs expense totals for each given month prefix. Transfers/adjustments are excluded. */
export function incomeVsExpense(transactions: Transaction[], monthPrefixes: string[]): MonthTotals[] {
  return monthPrefixes.map((month) => {
    let incomeMinor = 0;
    let expenseMinor = 0;
    for (const t of transactions) {
      if (!t.txnDate.startsWith(month)) continue;
      if (t.type === 'income') incomeMinor += t.amountMinor;
      else if (t.type === 'expense') expenseMinor += t.amountMinor;
    }
    return { month, incomeMinor, expenseMinor };
  });
}
