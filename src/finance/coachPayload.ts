import { addDays, type IsoDate } from '../engine';
import { budgetProgress } from './budget';
import { assessCashflow, DEFAULT_HORIZON_DAYS, projectCashflow, type CashflowOutlook } from './cashflow';
import { categoryBreakdown, incomeVsExpense } from './categoryTotals';
import { financeGoalProgress } from './goals';
import { assessFinancialHealth, computeFinancialHealthInputs, type FinancialHealthStatus } from './health';
import { accountBalanceAsOf, netWorthAsOf, netWorthSeries } from './netWorth';
import { lastNMonthPrefixes, monthEndDatesForPrefixes } from './periods';
import { projectNetWorth } from './projection';
import type {
  Account,
  AccountValuation,
  Budget,
  Category,
  FinanceGoal,
  RecurringTransaction,
  Transaction,
} from './types';

const DEFAULT_CURRENCY = 'INR';

export interface FinanceAccountSummary {
  name: string;
  type: string;
  balanceMinor: number;
  isLiability: boolean;
}

export interface FinanceGoalSummary {
  name: string;
  targetAmountMinor: number;
  savedMinor: number;
  targetDate: IsoDate | null;
}

export interface FinanceBudgetSummary {
  /** Null = the overall monthly budget. */
  categoryName: string | null;
  budgetedMinor: number;
  spentMinor: number;
}

export interface FinanceHealthReadSummary {
  status: FinancialHealthStatus;
  reasons: string[];
}

export interface FinanceProjectionPoint {
  monthsAhead: number;
  projectedNetWorthMinor: number;
}

/** Aggregates only, no raw transaction list — same "narrates, never computes" grounding contract as the health coach's CoachPayload. */
export interface FinanceCoachPayload {
  today: IsoDate;
  currency: string;
  netWorthMinor: number;
  month: { incomeMinor: number; expenseMinor: number };
  topExpenseCategories: { categoryName: string; totalMinor: number }[];
  accounts: FinanceAccountSummary[];
  goals: FinanceGoalSummary[];
  budgets: FinanceBudgetSummary[];
  healthRead: FinanceHealthReadSummary;
  projection: FinanceProjectionPoint[];
  /** Forward cash-flow read over the next `horizonDays` — the coach words it, never recomputes it. */
  cashflow: CashflowOutlook;
}

/** Pure aggregation only, mirroring assembleCoachPayload's contract for the health coach — never invents a number. */
export function assembleFinanceCoachPayload(
  accounts: Account[],
  transactions: Transaction[],
  valuations: AccountValuation[],
  goals: FinanceGoal[],
  budgets: Budget[],
  categories: Category[],
  recurringTransactions: RecurringTransaction[],
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

  const cashflow = assessCashflow(
    projectCashflow({
      accounts,
      transactions,
      recurringTransactions,
      today,
      startDate: today,
      endDate: addDays(today, DEFAULT_HORIZON_DAYS - 1),
    }),
  );

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
    cashflow,
  };
}
