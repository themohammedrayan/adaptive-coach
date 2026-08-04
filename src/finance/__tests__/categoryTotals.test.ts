import { categoryBreakdown, incomeVsExpense } from '../categoryTotals';
import type { Category, Transaction } from '../types';

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

const categories: Category[] = [
  { id: 'c1', externalId: 'sys-exp-food', name: 'Food', kind: 'expense', parentExternalId: null, isSystem: true, color: null, icon: null, updatedAt: '' },
  { id: 'c2', externalId: 'sys-exp-transport', name: 'Transport', kind: 'expense', parentExternalId: null, isSystem: true, color: null, icon: null, updatedAt: '' },
  { id: 'c3', externalId: 'sys-inc-salary', name: 'Salary', kind: 'income', parentExternalId: null, isSystem: true, color: null, icon: null, updatedAt: '' },
];

describe('categoryBreakdown', () => {
  it('totals expenses per category within the month, sorted largest first', () => {
    const transactions = [
      txn({ id: '1', externalId: '1', categoryExternalId: 'sys-exp-food', amountMinor: 500, txnDate: '2026-07-05' }),
      txn({ id: '2', externalId: '2', categoryExternalId: 'sys-exp-food', amountMinor: 300, txnDate: '2026-07-10' }),
      txn({ id: '3', externalId: '3', categoryExternalId: 'sys-exp-transport', amountMinor: 1200, txnDate: '2026-07-15' }),
      txn({ id: '4', externalId: '4', categoryExternalId: 'sys-exp-food', amountMinor: 999, txnDate: '2026-06-30' }), // wrong month
    ];
    expect(categoryBreakdown(transactions, categories, '2026-07', 'expense')).toEqual([
      { categoryExternalId: 'sys-exp-transport', categoryName: 'Transport', totalMinor: 1200, icon: '🚗', color: '#3B82F6' },
      { categoryExternalId: 'sys-exp-food', categoryName: 'Food', totalMinor: 800, icon: '🍔', color: '#E0A800' },
    ]);
  });

  it('excludes transfers and adjustments even if the month matches', () => {
    const transactions = [
      txn({
        id: '1',
        externalId: '1',
        type: 'transfer',
        counterAccountExternalId: 'acc-other',
        categoryExternalId: null,
        amountMinor: 5000,
        txnDate: '2026-07-05',
      }),
      txn({ id: '2', externalId: '2', type: 'adjustment', categoryExternalId: null, amountMinor: -100, txnDate: '2026-07-05' }),
    ];
    expect(categoryBreakdown(transactions, categories, '2026-07', 'expense')).toEqual([]);
  });
});

describe('incomeVsExpense', () => {
  it('totals income and expense per month prefix, excluding transfers/adjustments', () => {
    const transactions = [
      txn({ id: '1', externalId: '1', type: 'income', categoryExternalId: 'sys-inc-salary', amountMinor: 50000, txnDate: '2026-07-01' }),
      txn({ id: '2', externalId: '2', type: 'expense', amountMinor: 8000, txnDate: '2026-07-15' }),
      txn({
        id: '3',
        externalId: '3',
        type: 'transfer',
        counterAccountExternalId: 'acc-other',
        categoryExternalId: null,
        amountMinor: 20000,
        txnDate: '2026-07-20',
      }),
      txn({ id: '4', externalId: '4', type: 'expense', amountMinor: 500, txnDate: '2026-06-20' }),
    ];
    expect(incomeVsExpense(transactions, ['2026-06', '2026-07'])).toEqual([
      { month: '2026-06', incomeMinor: 0, expenseMinor: 500 },
      { month: '2026-07', incomeMinor: 50000, expenseMinor: 8000 },
    ]);
  });
});
