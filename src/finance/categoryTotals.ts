import { categoryAppearance } from './presetCategories';
import type { Category, CategoryKind, Transaction } from './types';

export interface CategoryTotal {
  categoryExternalId: string;
  categoryName: string;
  totalMinor: number;
  /** Resolved emoji — the category's own, else the seeded default. */
  icon: string;
  /** Resolved colour, or null when neither the row nor the seed has an opinion. */
  color: string | null;
}

/** Totals by category for one kind within a given period (day/month/year prefix), sorted largest first. Transfers/adjustments are never `kind`, so they're excluded automatically. */
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  periodPrefix: string,
  kind: CategoryKind,
): CategoryTotal[] {
  const categoryByExternalId = new Map(categories.map((c) => [c.externalId, c]));
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== kind || t.categoryExternalId === null || !t.txnDate.startsWith(periodPrefix)) continue;
    totals.set(t.categoryExternalId, (totals.get(t.categoryExternalId) ?? 0) + t.amountMinor);
  }
  return Array.from(totals.entries())
    .map(([categoryExternalId, totalMinor]) => {
      const category = categoryByExternalId.get(categoryExternalId);
      const appearance = categoryAppearance(categoryExternalId, category?.icon ?? null, category?.color ?? null);
      return {
        categoryExternalId,
        categoryName: category?.name ?? 'Unknown',
        totalMinor,
        icon: appearance.icon,
        color: appearance.color,
      };
    })
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
