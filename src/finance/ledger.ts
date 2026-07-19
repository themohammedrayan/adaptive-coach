import type { IsoDate } from '../engine';
import type { Transaction } from './types';

/** Signed effect of a transaction on one account's ledger balance. 0 if the transaction doesn't touch it. */
export function transactionEffectForAccount(txn: Transaction, accountExternalId: string): number {
  if (txn.type === 'transfer') {
    if (txn.accountExternalId === accountExternalId) return -txn.amountMinor;
    if (txn.counterAccountExternalId === accountExternalId) return txn.amountMinor;
    return 0;
  }
  if (txn.accountExternalId !== accountExternalId) return 0;
  switch (txn.type) {
    case 'income':
      return txn.amountMinor;
    case 'expense':
      return -txn.amountMinor;
    case 'adjustment':
      // Adjustment amounts are entered as the signed correction delta directly.
      return txn.amountMinor;
  }
}

/**
 * Ledger-account balance as of a date: opening balance plus every transaction
 * effect up to and including that date. Never overwritten by a snapshot — the
 * only way to correct drift is an explicit `adjustment` transaction.
 */
export function ledgerBalanceAsOf(
  openingBalanceMinor: number,
  accountExternalId: string,
  transactions: Transaction[],
  asOfDate: IsoDate,
): number {
  return transactions
    .filter((t) => t.txnDate <= asOfDate)
    .reduce((balance, t) => balance + transactionEffectForAccount(t, accountExternalId), openingBalanceMinor);
}
