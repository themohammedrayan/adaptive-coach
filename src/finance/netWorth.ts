import type { IsoDate } from '../engine';
import { ledgerBalanceAsOf } from './ledger';
import { sumMoney } from './money';
import type { Account, AccountValuation, Transaction } from './types';
import { latestValuationAsOf } from './valuations';

/**
 * Resolves an account's balance as of a date, branching on how it derives its
 * balance. Null if a valuation account has no entry yet.
 *
 * Liability balances are always returned as a **positive amount owed**, which is
 * what `accountNetWorthContribution` and credit-utilization both expect. For a
 * ledger-mode liability that means the transaction effects run the other way:
 * an expense on a credit card increases what you owe, and a transfer into it
 * (a payment) reduces it. Only the effects flip — the opening balance is
 * already entered as an amount owed.
 */
export function accountBalanceAsOf(
  account: Account,
  transactions: Transaction[],
  valuations: AccountValuation[],
  asOfDate: IsoDate,
): number | null {
  if (account.balanceMode === 'ledger') {
    if (!account.isLiability) {
      return ledgerBalanceAsOf(account.openingBalanceMinor, account.externalId, transactions, asOfDate);
    }
    const effectsMinor = ledgerBalanceAsOf(0, account.externalId, transactions, asOfDate);
    return account.openingBalanceMinor - effectsMinor;
  }
  return latestValuationAsOf(valuations, account.externalId, asOfDate);
}

/**
 * The one place net-worth sign logic lives: liabilities subtract, everything
 * else adds. Applied uniformly regardless of balance_mode.
 */
export function accountNetWorthContribution(account: Account, balanceMinor: number | null): number {
  if (balanceMinor === null) return 0;
  return account.isLiability ? -balanceMinor : balanceMinor;
}

/** Net worth as of a date: archived accounts are excluded, accounts with no valuation yet contribute 0. */
export function netWorthAsOf(
  accounts: Account[],
  transactions: Transaction[],
  valuations: AccountValuation[],
  asOfDate: IsoDate,
): number {
  return sumMoney(
    accounts
      .filter((a) => a.archivedAt === null)
      .map((a) => accountNetWorthContribution(a, accountBalanceAsOf(a, transactions, valuations, asOfDate))),
  );
}

export interface NetWorthPoint {
  date: IsoDate;
  netWorthMinor: number;
}

/** Samples netWorthAsOf at each given date — e.g. month-end for the last 12 months. */
export function netWorthSeries(
  accounts: Account[],
  transactions: Transaction[],
  valuations: AccountValuation[],
  sampleDates: IsoDate[],
): NetWorthPoint[] {
  return sampleDates.map((date) => ({
    date,
    netWorthMinor: netWorthAsOf(accounts, transactions, valuations, date),
  }));
}
