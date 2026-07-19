import type { IsoDate } from '../engine';
import { budgetProgress } from './budget';
import { incomeVsExpense } from './categoryTotals';
import { accountBalanceAsOf, netWorthSeries } from './netWorth';
import { lastNMonthPrefixes, monthEndDatesForPrefixes } from './periods';
import type { Account, AccountValuation, Budget, Category, Transaction } from './types';

export type FinancialHealthStatus = 'good' | 'mixed' | 'concerning';

export interface FinancialHealthInputs {
  /** Average (income - expense) / income across the trailing window. Null if there's no income data yet. */
  savingsRatePct: number | null;
  /** % change in net worth across the trailing window. Null if there isn't enough history yet. */
  netWorthTrendPct: number | null;
  overBudgetCount: number;
  totalBudgetCount: number;
  /** Total liabilities / total assets. Null if there are no assets yet. */
  liabilitiesToAssetsRatio: number | null;
  /** Highest utilization among credit cards with a limit set. Null if none have a limit. */
  maxCreditUtilizationPct: number | null;
}

export interface FinancialHealthRead {
  status: FinancialHealthStatus;
  reasons: string[];
}

/**
 * Rule-based, deterministic — same spirit as the engine's Reason codes: fixed
 * thresholds score each signal, the coach only narrates the result, it never
 * invents the read itself.
 */
export function assessFinancialHealth(inputs: FinancialHealthInputs): FinancialHealthRead {
  let score = 0;
  const good: string[] = [];
  const bad: string[] = [];

  if (inputs.savingsRatePct !== null) {
    if (inputs.savingsRatePct < 0) {
      score -= 2;
      bad.push(`You're spending more than you earn (${Math.round(-inputs.savingsRatePct)}% over income).`);
    } else if (inputs.savingsRatePct >= 20) {
      score += 2;
      good.push(`You're saving ${Math.round(inputs.savingsRatePct)}% of your income.`);
    } else {
      good.push(`You're saving ${Math.round(inputs.savingsRatePct)}% of your income.`);
    }
  }

  if (inputs.netWorthTrendPct !== null) {
    if (inputs.netWorthTrendPct > 0) {
      score += 1;
      good.push(`Net worth is trending up (${Math.round(inputs.netWorthTrendPct)}% over the period).`);
    } else if (inputs.netWorthTrendPct < 0) {
      score -= 1;
      bad.push(`Net worth is trending down (${Math.round(inputs.netWorthTrendPct)}% over the period).`);
    }
  }

  if (inputs.totalBudgetCount > 0) {
    if (inputs.overBudgetCount === 0) {
      score += 1;
      good.push('You’re within budget everywhere you’ve set one.');
    } else if (inputs.overBudgetCount > inputs.totalBudgetCount / 2) {
      score -= 1;
      bad.push(`You're over budget in ${inputs.overBudgetCount} of ${inputs.totalBudgetCount} categories.`);
    }
  }

  if (inputs.liabilitiesToAssetsRatio !== null) {
    if (inputs.liabilitiesToAssetsRatio > 0.7) {
      score -= 1;
      bad.push('Liabilities are high relative to assets.');
    } else if (inputs.liabilitiesToAssetsRatio < 0.3) {
      score += 1;
      good.push('Liabilities are low relative to assets.');
    }
  }

  if (inputs.maxCreditUtilizationPct !== null) {
    if (inputs.maxCreditUtilizationPct > 80) {
      score -= 2;
      bad.push(`A credit card is at ${Math.round(inputs.maxCreditUtilizationPct)}% of its limit.`);
    } else if (inputs.maxCreditUtilizationPct < 30) {
      score += 1;
      good.push('Credit card utilization is low.');
    }
  }

  const status: FinancialHealthStatus = score >= 2 ? 'good' : score <= -2 ? 'concerning' : 'mixed';
  const reasons = status === 'good' ? good : [...bad, ...good];
  if (reasons.length === 0) reasons.push('Not enough data yet to read your finances — add accounts and log some transactions.');

  return { status, reasons: reasons.slice(0, 3) };
}

/** Derives the signals assessFinancialHealth() needs from raw finance data — savings rate over 3 months, net-worth trend over 6, this month's budget adherence, and current liabilities/credit utilization. */
export function computeFinancialHealthInputs(
  accounts: Account[],
  transactions: Transaction[],
  valuations: AccountValuation[],
  budgets: Budget[],
  categories: Category[],
  today: IsoDate,
): FinancialHealthInputs {
  const recentMonths = incomeVsExpense(transactions, lastNMonthPrefixes(today, 3));
  const totalIncome = recentMonths.reduce((sum, m) => sum + m.incomeMinor, 0);
  const totalExpense = recentMonths.reduce((sum, m) => sum + m.expenseMinor, 0);
  const savingsRatePct = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : null;

  const monthEnds = monthEndDatesForPrefixes(lastNMonthPrefixes(today, 6));
  const series = netWorthSeries(accounts, transactions, valuations, monthEnds);
  const first = series[0]?.netWorthMinor ?? 0;
  const last = series[series.length - 1]?.netWorthMinor ?? 0;
  const netWorthTrendPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;

  const progress = budgetProgress(budgets, transactions, categories, today.slice(0, 7));
  const overBudgetCount = progress.filter((p) => p.pct > 1).length;
  const totalBudgetCount = progress.length;

  const activeAccounts = accounts.filter((a) => a.archivedAt === null);
  let assetsMinor = 0;
  let liabilitiesMinor = 0;
  for (const account of activeAccounts) {
    const balance = accountBalanceAsOf(account, transactions, valuations, today) ?? 0;
    if (account.isLiability) liabilitiesMinor += balance;
    else assetsMinor += balance;
  }
  const liabilitiesToAssetsRatio = assetsMinor > 0 ? liabilitiesMinor / assetsMinor : null;

  const utilizations = activeAccounts
    .filter((a): a is Account & { creditLimitMinor: number } => a.type === 'credit_card' && (a.creditLimitMinor ?? 0) > 0)
    .map((a) => ((accountBalanceAsOf(a, transactions, valuations, today) ?? 0) / a.creditLimitMinor) * 100);
  const maxCreditUtilizationPct = utilizations.length > 0 ? Math.max(...utilizations) : null;

  return {
    savingsRatePct,
    netWorthTrendPct,
    overBudgetCount,
    totalBudgetCount,
    liabilitiesToAssetsRatio,
    maxCreditUtilizationPct,
  };
}
