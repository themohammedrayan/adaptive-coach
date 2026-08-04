import { diffDays, type IsoDate } from '../engine';
import { categoryBreakdown } from './categoryTotals';
import { categoryAppearance } from './presetCategories';
import { occurrenceDatesBetween } from './recurrenceDates';
import type { Budget, Category, MoneyMinor, RecurringTransaction, Transaction } from './types';

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

export interface BudgetEnvelope {
  /** The overall monthly cap (the null-category budget). Zero when none is set. */
  totalBudgetMinor: MoneyMinor;
  /** Sum of the per-category budgets. */
  assignedMinor: MoneyMinor;
  /** total − assigned. Negative means the categories over-commit the overall cap. */
  unassignedMinor: MoneyMinor;
  spentMinor: MoneyMinor;
  /** total − spent. Unlike BudgetProgress.remainingMinor this is NOT clamped: overspend is the point. */
  remainingMinor: MoneyMinor;
  /** True when no overall cap has been set, so `total`-derived figures are meaningless. */
  hasOverallBudget: boolean;
  rows: BudgetProgress[];
}

/**
 * Envelope view of a month: what the overall cap is, how much of it the
 * per-category budgets have claimed, and what's actually been spent.
 *
 * `budgetProgress` answers each budget independently; this is the reconciliation
 * across them, which is what makes an envelope an envelope.
 */
export function budgetEnvelope(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  monthPrefix: string,
): BudgetEnvelope {
  const rows = budgetProgress(budgets, transactions, categories, monthPrefix);
  const overall = rows.find((r) => r.categoryExternalId === null) ?? null;

  const totalBudgetMinor = overall?.budgetedMinor ?? 0;
  const assignedMinor = rows
    .filter((r) => r.categoryExternalId !== null)
    .reduce((sum, r) => sum + r.budgetedMinor, 0);

  // Spend is the same figure either way, but without an overall budget there's
  // no null-category row to read it from.
  const spentMinor =
    overall?.spentMinor ??
    categoryBreakdown(transactions, categories, monthPrefix, 'expense').reduce((sum, c) => sum + c.totalMinor, 0);

  return {
    totalBudgetMinor,
    assignedMinor,
    unassignedMinor: totalBudgetMinor - assignedMinor,
    spentMinor,
    remainingMinor: totalBudgetMinor - spentMinor,
    hasOverallBudget: overall !== null,
    rows,
  };
}

export interface UpcomingExpense {
  /** `${ruleExternalId}@${date}` — stable across renders. */
  key: string;
  date: IsoDate;
  daysAway: number;
  amountMinor: MoneyMinor;
  label: string | null;
  icon: string;
}

/**
 * Scheduled expenses still to land in a window, grouped by category.
 *
 * Sourced from the recurrence rules directly rather than from `projectCashflow`,
 * which restricts itself to the spendable pool — a subscription charged to a
 * credit card produces no projected event at all there and would silently
 * vanish from its category.
 */
export function upcomingByCategory(
  rules: RecurringTransaction[],
  categories: Category[],
  from: IsoDate,
  through: IsoDate,
): Map<string, UpcomingExpense[]> {
  const categoryByExternalId = new Map(categories.map((c) => [c.externalId, c]));
  const out = new Map<string, UpcomingExpense[]>();

  for (const rule of rules) {
    if (!rule.active || rule.type !== 'expense' || rule.categoryExternalId === null) continue;
    const category = categoryByExternalId.get(rule.categoryExternalId);
    const icon = categoryAppearance(rule.categoryExternalId, category?.icon ?? null, category?.color ?? null).icon;

    // Walk from the rule's own start and filter, rather than seeding the
    // generator with `from` — `fromExclusive` must itself be an occurrence date,
    // and an arbitrary one throws daily/weekly rules off their grid.
    for (const date of occurrenceDatesBetween(rule, null, through)) {
      if (date < from) continue;
      const entry: UpcomingExpense = {
        key: `${rule.externalId}@${date}`,
        date,
        daysAway: diffDays(date, from),
        amountMinor: rule.amountMinor,
        label: rule.note,
        icon,
      };
      const bucket = out.get(rule.categoryExternalId);
      if (bucket === undefined) out.set(rule.categoryExternalId, [entry]);
      else bucket.push(entry);
    }
  }

  for (const bucket of out.values()) bucket.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
