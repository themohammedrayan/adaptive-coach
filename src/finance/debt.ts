import { addDays, type IsoDate } from '../engine';
import { accountBalanceAsOf } from './netWorth';
import { monthEndDatesForPrefixes } from './periods';
import { clampDayOfMonth } from './recurrenceDates';
import type { Account, AccountValuation, MoneyMinor, Transaction } from './types';

/**
 * Debt ranking and statement-cycle tracking over the accounts already modelled
 * as liabilities: credit cards (ledger-mode) and loans (valuation-mode).
 *
 * Pure and deterministic — `today` is a parameter. Nothing here stores a
 * "paid this cycle" flag; that is derived from logged payments, the same way
 * `financeGoalProgress` never stores a "saved so far" figure.
 */

export type PayoffStrategy = 'avalanche' | 'snowball';
export type CycleStatus = 'paid' | 'partial' | 'unpaid' | 'no_minimum';

export interface StatementCycle {
  start: IsoDate;
  due: IsoDate;
}

export interface DebtLine {
  account: Account;
  /** Positive = amount owed. */
  balanceMinor: MoneyMinor;
  aprPct: number | null;
  minimumPaymentMinor: MoneyMinor | null;
  creditLimitMinor: MoneyMinor | null;
  /** Null when no limit is set. */
  utilizationPct: number | null;
  cycle: StatementCycle;
  paidThisCycleMinor: MoneyMinor;
  cycleStatus: CycleStatus;
}

export interface DebtOverview {
  /** In payoff order. Zero-balance debts sort last regardless of strategy. */
  lines: DebtLine[];
  totalOutstandingMinor: MoneyMinor;
  totalMinimumDueMinor: MoneyMinor;
  /** Debts whose minimum is already covered this cycle. */
  paidCount: number;
  cardCount: number;
  loanCount: number;
}

export function isDebtAccount(account: Account): boolean {
  return account.type === 'credit_card' || account.type === 'loan';
}

/**
 * The statement cycle containing `today`, ending on the next occurrence of
 * `dueDay`. Cycles partition the calendar with no overlap: a cycle starts the
 * day after the previous due date.
 *
 * With no due day set there is nothing to anchor to, so the calendar month
 * stands in.
 */
export function statementCycle(dueDay: number | null, today: IsoDate): StatementCycle {
  const monthPrefix = today.slice(0, 7);
  if (dueDay === null) {
    return { start: `${monthPrefix}-01`, due: monthEndDatesForPrefixes([monthPrefix])[0] };
  }

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const thisMonthDue = clampDayOfMonth(year, month, dueDay);

  const [dueYear, dueMonth] =
    today <= thisMonthDue
      ? [year, month]
      : month === 12
        ? [year + 1, 1]
        : [year, month + 1];
  const [prevYear, prevMonth] = dueMonth === 1 ? [dueYear - 1, 12] : [dueYear, dueMonth - 1];

  const due = clampDayOfMonth(dueYear, dueMonth, dueDay);
  return { start: addDays(clampDayOfMonth(prevYear, prevMonth, dueDay), 1), due };
}

/**
 * What's been paid toward a debt this cycle. A payment is a transfer *into* the
 * account — the same transaction that shows on the cash-flow calendar as money
 * leaving a spendable account.
 */
export function paidInCycle(
  accountExternalId: string,
  transactions: Transaction[],
  cycle: StatementCycle,
): MoneyMinor {
  return transactions
    .filter(
      (t) =>
        t.type === 'transfer' &&
        t.counterAccountExternalId === accountExternalId &&
        t.txnDate >= cycle.start &&
        t.txnDate <= cycle.due,
    )
    .reduce((sum, t) => sum + t.amountMinor, 0);
}

function cycleStatusFor(paidMinor: MoneyMinor, minimumMinor: MoneyMinor | null): CycleStatus {
  if (minimumMinor === null || minimumMinor <= 0) return 'no_minimum';
  if (paidMinor >= minimumMinor) return 'paid';
  return paidMinor > 0 ? 'partial' : 'unpaid';
}

/**
 * Ranks debts by strategy.
 *
 * Avalanche sorts by APR descending, but a **null APR sorts last** rather than
 * as zero — an unknown rate must not be asserted to be the best thing to pay.
 * Snowball sorts by balance ascending. Both tie-break on externalId so the
 * order — and therefore the "pay first" badge — is stable between renders.
 * Cleared debts always sort last.
 */
export function payoffOrder(lines: DebtLine[], strategy: PayoffStrategy): DebtLine[] {
  return [...lines].sort((a, b) => {
    const aCleared = a.balanceMinor <= 0;
    const bCleared = b.balanceMinor <= 0;
    if (aCleared !== bCleared) return aCleared ? 1 : -1;

    if (strategy === 'avalanche') {
      if (a.aprPct === null || b.aprPct === null) {
        if (a.aprPct !== b.aprPct) return a.aprPct === null ? 1 : -1;
      } else if (a.aprPct !== b.aprPct) {
        return b.aprPct - a.aprPct;
      }
    } else if (a.balanceMinor !== b.balanceMinor) {
      return a.balanceMinor - b.balanceMinor;
    }

    return a.account.externalId < b.account.externalId ? -1 : a.account.externalId > b.account.externalId ? 1 : 0;
  });
}

export function buildDebtOverview(
  accounts: Account[],
  transactions: Transaction[],
  valuations: AccountValuation[],
  today: IsoDate,
  strategy: PayoffStrategy,
): DebtOverview {
  const debts = accounts.filter((a) => a.archivedAt === null && isDebtAccount(a));

  const lines: DebtLine[] = debts.map((account) => {
    // Always a positive amount owed — accountBalanceAsOf normalises ledger-mode
    // liabilities so spending increases the figure.
    const balanceMinor = accountBalanceAsOf(account, transactions, valuations, today) ?? 0;
    const cycle = statementCycle(account.dueDay, today);
    const paidThisCycleMinor = paidInCycle(account.externalId, transactions, cycle);
    const limit = account.creditLimitMinor;

    return {
      account,
      balanceMinor,
      aprPct: account.interestRate,
      minimumPaymentMinor: account.minimumPaymentMinor,
      creditLimitMinor: limit,
      utilizationPct: limit !== null && limit > 0 ? (balanceMinor / limit) * 100 : null,
      cycle,
      paidThisCycleMinor,
      cycleStatus: cycleStatusFor(paidThisCycleMinor, account.minimumPaymentMinor),
    };
  });

  return {
    lines: payoffOrder(lines, strategy),
    totalOutstandingMinor: lines.reduce((sum, l) => sum + Math.max(0, l.balanceMinor), 0),
    totalMinimumDueMinor: lines.reduce(
      (sum, l) => (l.balanceMinor > 0 ? sum + (l.minimumPaymentMinor ?? 0) : sum),
      0,
    ),
    paidCount: lines.filter((l) => l.cycleStatus === 'paid').length,
    cardCount: lines.filter((l) => l.account.type === 'credit_card').length,
    loanCount: lines.filter((l) => l.account.type === 'loan').length,
  };
}
