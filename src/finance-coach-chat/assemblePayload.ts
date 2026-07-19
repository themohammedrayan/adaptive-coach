import type { IsoDate } from '../engine';
import { budgetProgress } from '../finance/budget';
import { categoryBreakdown, incomeVsExpense } from '../finance/categoryTotals';
import { financeGoalProgress } from '../finance/goals';
import { assessFinancialHealth, computeFinancialHealthInputs } from '../finance/health';
import { accountBalanceAsOf, netWorthAsOf, netWorthSeries } from '../finance/netWorth';
import { lastNMonthPrefixes, monthEndDatesForPrefixes } from '../finance/periods';
import { projectNetWorth } from '../finance/projection';
import type { Account, AccountValuation, Budget, Category, FinanceGoal, Transaction } from '../finance/types';
import type { FinanceCoachPayload } from './types';

const DEFAULT_CURRENCY = 'INR';

/** Pure aggregation only, mirroring assembleCoachPayload's contract for the health coach — never invents a number. */
export function assembleFinanceCoachPayload(
  accounts: Account[],
  transactions: Transaction[],
  valuations: AccountValuation[],
  goals: FinanceGoal[],
  budgets: Budget[],
  categories: Category[],
  today: IsoDate,
): FinanceCoachPayload {
  const activeAccounts = accounts.filter((a) => a.archivedAt === null);
  const currency = activeAccounts[0]?.currency ?? DEFAULT_CURRENCY;
  const monthPrefix = today.slice(0, 7);

  const netWorthMinor = netWorthAsOf(accounts, transactions, valuations, today);
  const [monthTotals] = incomeVsExpense(transactions, [monthPrefix]);

  const topExpenseCategories = categoryBreakdown(transactions, categories, monthPrefix, 'expense')
    .slice(0, 5)
    .map((c) => ({ categoryName: c.categoryName, totalMinor: c.totalMinor }));

  const accountSummaries = activeAccounts.map((a) => ({
    name: a.name,
    type: a.type,
    balanceMinor: accountBalanceAsOf(a, transactions, valuations, today) ?? 0,
    isLiability: a.isLiability,
  }));

  const goalSummaries = goals
    .filter((g) => g.status === 'active')
    .map((g) => {
      const account = accounts.find((a) => a.externalId === g.linkedAccountExternalId);
      const balance = account !== undefined ? (accountBalanceAsOf(account, transactions, valuations, today) ?? 0) : 0;
      const progress = financeGoalProgress(g, balance);
      return {
        name: g.name,
        targetAmountMinor: g.targetAmountMinor,
        savedMinor: progress.savedMinor,
        targetDate: g.targetDate,
      };
    });

  const categoryNameByExternalId = new Map(categories.map((c) => [c.externalId, c.name]));
  const budgetSummaries = budgetProgress(budgets, transactions, categories, monthPrefix).map((p) => ({
    categoryName: p.categoryExternalId === null ? null : (categoryNameByExternalId.get(p.categoryExternalId) ?? 'Unknown'),
    budgetedMinor: p.budgetedMinor,
    spentMinor: p.spentMinor,
  }));

  const healthRead = assessFinancialHealth(
    computeFinancialHealthInputs(accounts, transactions, valuations, budgets, categories, today),
  );

  const projectionHistory = netWorthSeries(
    accounts,
    transactions,
    valuations,
    monthEndDatesForPrefixes(lastNMonthPrefixes(today, 12)),
  );
  const projection = projectNetWorth(projectionHistory, [3, 6, 12]);

  return {
    today,
    currency,
    netWorthMinor,
    month: { incomeMinor: monthTotals?.incomeMinor ?? 0, expenseMinor: monthTotals?.expenseMinor ?? 0 },
    topExpenseCategories,
    accounts: accountSummaries,
    goals: goalSummaries,
    budgets: budgetSummaries,
    healthRead,
    projection,
  };
}
