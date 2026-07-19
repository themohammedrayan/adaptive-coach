import { ledgerBalanceAsOf, transactionEffectForAccount } from '../ledger';
import type { Transaction } from '../types';

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    externalId: 't1',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: 'sys-exp-food',
    amountMinor: 1000,
    currency: 'INR',
    note: null,
    txnDate: '2026-07-01',
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('transactionEffectForAccount', () => {
  it('expense is a negative effect on its account', () => {
    expect(transactionEffectForAccount(txn({ type: 'expense', amountMinor: 500 }), 'acc-bank')).toBe(-500);
  });

  it('income is a positive effect on its account', () => {
    expect(
      transactionEffectForAccount(txn({ type: 'income', categoryExternalId: 'sys-inc-salary', amountMinor: 500 }), 'acc-bank'),
    ).toBe(500);
  });

  it('transfer is negative on the from-account and positive on the counter-account', () => {
    const t = txn({
      type: 'transfer',
      accountExternalId: 'acc-bank',
      counterAccountExternalId: 'acc-card',
      categoryExternalId: null,
      amountMinor: 500,
    });
    expect(transactionEffectForAccount(t, 'acc-bank')).toBe(-500);
    expect(transactionEffectForAccount(t, 'acc-card')).toBe(500);
  });

  it('adjustment applies its signed amount directly, either direction', () => {
    expect(
      transactionEffectForAccount(txn({ type: 'adjustment', categoryExternalId: null, amountMinor: -300 }), 'acc-bank'),
    ).toBe(-300);
    expect(
      transactionEffectForAccount(txn({ type: 'adjustment', categoryExternalId: null, amountMinor: 300 }), 'acc-bank'),
    ).toBe(300);
  });

  it('is 0 for a transaction that does not touch the account', () => {
    expect(transactionEffectForAccount(txn({ accountExternalId: 'acc-other' }), 'acc-bank')).toBe(0);
  });
});

describe('ledgerBalanceAsOf', () => {
  it('replays opening balance plus every transaction up to and including the date', () => {
    const transactions = [
      txn({ id: '1', externalId: '1', type: 'income', categoryExternalId: 'sys-inc-salary', amountMinor: 10000, txnDate: '2026-07-01' }),
      txn({ id: '2', externalId: '2', type: 'expense', amountMinor: 3000, txnDate: '2026-07-05' }),
      txn({ id: '3', externalId: '3', type: 'expense', amountMinor: 2000, txnDate: '2026-07-20' }), // after asOfDate
    ];
    expect(ledgerBalanceAsOf(5000, 'acc-bank', transactions, '2026-07-10')).toBe(5000 + 10000 - 3000);
  });

  it('a credit card goes negative on spend and recovers via a payment transfer', () => {
    const transactions = [
      txn({ id: '1', externalId: '1', type: 'expense', accountExternalId: 'acc-card', amountMinor: 4000, txnDate: '2026-07-01' }),
      txn({
        id: '2',
        externalId: '2',
        type: 'transfer',
        accountExternalId: 'acc-bank',
        counterAccountExternalId: 'acc-card',
        categoryExternalId: null,
        amountMinor: 4000,
        txnDate: '2026-07-15',
      }),
    ];
    expect(ledgerBalanceAsOf(0, 'acc-card', transactions, '2026-07-05')).toBe(-4000);
    expect(ledgerBalanceAsOf(0, 'acc-card', transactions, '2026-07-20')).toBe(0);
  });

  it('an adjustment corrects drift without touching opening balance', () => {
    const transactions = [txn({ id: '1', externalId: '1', type: 'adjustment', categoryExternalId: null, amountMinor: -150, txnDate: '2026-07-10' })];
    expect(ledgerBalanceAsOf(1000, 'acc-bank', transactions, '2026-07-15')).toBe(850);
  });
});
