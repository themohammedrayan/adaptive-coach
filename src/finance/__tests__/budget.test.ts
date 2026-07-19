import { budgetProgress } from '../budget';
import type { Budget, Category, Transaction } from '../types';

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

function budget(overrides: Partial<Budget>): Budget {
  return {
    id: 'b1',
    externalId: 'b1',
    categoryExternalId: 'sys-exp-food',
    amountMinor: 100_000,
    currency: 'INR',
    archivedAt: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const categories: Category[] = [
  { id: 'c1', externalId: 'sys-exp-food', name: 'Food', kind: 'expense', parentExternalId: null, isSystem: true, color: null, updatedAt: '' },
  { id: 'c2', externalId: 'sys-exp-transport', name: 'Transport', kind: 'expense', parentExternalId: null, isSystem: true, color: null, updatedAt: '' },
];

describe('budgetProgress', () => {
  it('tracks spend against a per-category budget for the month', () => {
    const transactions = [txn({ amountMinor: 30_000, txnDate: '2026-07-10' })];
    const budgets = [budget({})];
    expect(budgetProgress(budgets, transactions, categories, '2026-07')).toEqual([
      { categoryExternalId: 'sys-exp-food', budgetedMinor: 100_000, spentMinor: 30_000, pct: 0.3, remainingMinor: 70_000 },
    ]);
  });

  it('tracks spend across all categories against the overall budget', () => {
    const transactions = [
      txn({ id: '1', externalId: '1', categoryExternalId: 'sys-exp-food', amountMinor: 30_000 }),
      txn({ id: '2', externalId: '2', categoryExternalId: 'sys-exp-transport', amountMinor: 20_000 }),
    ];
    const budgets = [budget({ categoryExternalId: null, amountMinor: 100_000 })];
    expect(budgetProgress(budgets, transactions, categories, '2026-07')).toEqual([
      { categoryExternalId: null, budgetedMinor: 100_000, spentMinor: 50_000, pct: 0.5, remainingMinor: 50_000 },
    ]);
  });

  it('excludes archived budgets', () => {
    const budgets = [budget({ archivedAt: '2026-07-01T00:00:00.000Z' })];
    expect(budgetProgress(budgets, [], categories, '2026-07')).toEqual([]);
  });

  it('clamps remaining to zero once over budget', () => {
    const transactions = [txn({ amountMinor: 150_000 })];
    const budgets = [budget({ amountMinor: 100_000 })];
    const [progress] = budgetProgress(budgets, transactions, categories, '2026-07');
    expect(progress.pct).toBe(1.5);
    expect(progress.remainingMinor).toBe(0);
  });
});
