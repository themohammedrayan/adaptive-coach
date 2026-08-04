import { budgetEnvelope, budgetProgress, upcomingByCategory } from '../budget';
import type { Budget, Category, RecurringTransaction, Transaction } from '../types';

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
  { id: 'c1', externalId: 'sys-exp-food', name: 'Food', kind: 'expense', parentExternalId: null, isSystem: true, color: null, icon: null, updatedAt: '' },
  { id: 'c2', externalId: 'sys-exp-transport', name: 'Transport', kind: 'expense', parentExternalId: null, isSystem: true, color: null, icon: null, updatedAt: '' },
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

function rule(overrides: Partial<RecurringTransaction>): RecurringTransaction {
  return {
    id: 'r1',
    externalId: 'r1',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: 'sys-exp-food',
    amountMinor: 50000,
    currency: 'INR',
    note: 'Groceries',
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 10,
    startDate: '2026-01-10',
    endDate: null,
    lastMaterializedDate: null,
    active: true,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('budgetEnvelope', () => {
  const overall = budget({ externalId: 'overall', categoryExternalId: null, amountMinor: 4000000 });
  const food = budget({ externalId: 'b-food', categoryExternalId: 'sys-exp-food', amountMinor: 2000000 });
  const transport = budget({ externalId: 'b-transport', categoryExternalId: 'sys-exp-transport', amountMinor: 1500000 });

  it('reports what is left unassigned out of the overall cap', () => {
    const e = budgetEnvelope([overall, food, transport], [], categories, '2026-07');
    expect(e.totalBudgetMinor).toBe(4000000);
    expect(e.assignedMinor).toBe(3500000); // 2,000,000 + 1,500,000
    expect(e.unassignedMinor).toBe(500000);
    expect(e.hasOverallBudget).toBe(true);
  });

  it('goes negative when the categories over-commit the overall cap', () => {
    const greedy = budget({ externalId: 'b-x', categoryExternalId: 'sys-exp-transport', amountMinor: 3000000 });
    const e = budgetEnvelope([overall, food, greedy], [], categories, '2026-07');
    expect(e.unassignedMinor).toBe(-1000000); // 4,000,000 − 5,000,000
  });

  it('does NOT clamp remaining, so overspend is visible', () => {
    // budgetProgress clamps its own remainingMinor at 0; the envelope must not.
    const txns = [txn({ id: 'x', externalId: 'x', categoryExternalId: 'sys-exp-food', amountMinor: 5000000, txnDate: '2026-07-05' })];
    const e = budgetEnvelope([overall], txns, categories, '2026-07');
    expect(e.spentMinor).toBe(5000000);
    expect(e.remainingMinor).toBe(-1000000); // 4,000,000 − 5,000,000
  });

  it('still totals spend when no overall budget exists', () => {
    const txns = [txn({ id: 'y', externalId: 'y', categoryExternalId: 'sys-exp-food', amountMinor: 300000, txnDate: '2026-07-05' })];
    const e = budgetEnvelope([food], txns, categories, '2026-07');
    expect(e.hasOverallBudget).toBe(false);
    expect(e.totalBudgetMinor).toBe(0);
    expect(e.spentMinor).toBe(300000);
  });

  it('ignores archived budgets on both sides of the reconciliation', () => {
    const dead = budget({ externalId: 'b-dead', categoryExternalId: 'sys-exp-transport', amountMinor: 9900000, archivedAt: '2026-06-01T00:00:00.000Z' });
    const e = budgetEnvelope([overall, food, dead], [], categories, '2026-07');
    expect(e.assignedMinor).toBe(2000000);
  });

  it('is all zeroes with no budgets at all', () => {
    const e = budgetEnvelope([], [], categories, '2026-07');
    expect(e).toEqual({
      totalBudgetMinor: 0,
      assignedMinor: 0,
      unassignedMinor: 0,
      spentMinor: 0,
      remainingMinor: 0,
      hasOverallBudget: false,
      rows: [],
    });
  });
});

describe('upcomingByCategory', () => {
  it('lists a rule occurrence in the window under its category', () => {
    const map = upcomingByCategory([rule({})], categories, '2026-07-01', '2026-07-31');
    const food = map.get('sys-exp-food')!;
    expect(food).toHaveLength(1);
    expect(food[0]).toMatchObject({ date: '2026-07-10', daysAway: 9, amountMinor: 50000, icon: '🍔' });
  });

  it('includes an occurrence falling on the window’s first day', () => {
    const map = upcomingByCategory([rule({ dayOfMonth: 1, startDate: '2026-01-01' })], categories, '2026-07-01', '2026-07-31');
    expect(map.get('sys-exp-food')!.map((u) => u.date)).toEqual(['2026-07-01']);
  });

  it('keeps a card-charged subscription, which projectCashflow would drop', () => {
    // The account is a credit card, so this never touches the spendable pool —
    // the whole reason chips are sourced from the rules instead.
    const map = upcomingByCategory([rule({ accountExternalId: 'acc-credit-card' })], categories, '2026-07-01', '2026-07-31');
    expect(map.get('sys-exp-food')).toHaveLength(1);
  });

  it('skips inactive rules, income rules, and rules with no category', () => {
    const rules = [
      rule({ externalId: 'off', active: false }),
      rule({ externalId: 'inc', type: 'income', categoryExternalId: 'sys-inc-salary' }),
      rule({ externalId: 'nocat', categoryExternalId: null }),
    ];
    expect(upcomingByCategory(rules, categories, '2026-07-01', '2026-07-31').size).toBe(0);
  });

  it('sorts several occurrences of one category by date', () => {
    const weekly = rule({ externalId: 'w', frequency: 'weekly', interval: 1, dayOfMonth: null, startDate: '2026-07-06' });
    const dates = upcomingByCategory([weekly], categories, '2026-07-01', '2026-07-31').get('sys-exp-food')!.map((u) => u.date);
    expect(dates).toEqual(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27']);
  });

  it('returns nothing when the window is before the rule starts', () => {
    expect(upcomingByCategory([rule({ startDate: '2027-01-10' })], categories, '2026-07-01', '2026-07-31').size).toBe(0);
  });
});
