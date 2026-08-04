import { assembleFinanceCoachPayload } from '../coachPayload';
import type { Account, Budget, Category, FinanceGoal, Transaction } from '../types';

const account: Account = {
  id: 'acc-bank',
  externalId: 'acc-bank',
  name: 'Bank',
  type: 'bank',
  balanceMode: 'ledger',
  isLiability: false,
  currency: 'INR',
  openingBalanceMinor: 500_000,
  openingDate: '2026-01-01',
  interestRate: null,
  minimumPaymentMinor: null,
  dueDay: null,
  creditLimitMinor: null,
  source: 'manual',
  archivedAt: null,
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const category: Category = {
  id: 'sys-exp-food',
  externalId: 'sys-exp-food',
  name: 'Food',
  kind: 'expense',
  parentExternalId: null,
  isSystem: true,
  color: null,
  icon: null,
  updatedAt: '',
};

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    externalId: 't1',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: 'sys-exp-food',
    amountMinor: 10_000,
    currency: 'INR',
    note: null,
    txnDate: '2026-07-05',
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...overrides,
  };
}

const goal: FinanceGoal = {
  id: 'g1',
  externalId: 'g1',
  name: 'House fund',
  targetAmountMinor: 1_000_000,
  currency: 'INR',
  linkedAccountExternalId: 'acc-bank',
  targetDate: '2027-01-01',
  contributionAmountMinor: null,
  contributionCadence: null,
  contributionFlexible: true,
  status: 'active',
  archivedAt: null,
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const budget: Budget = {
  id: 'b1',
  externalId: 'b1',
  categoryExternalId: 'sys-exp-food',
  amountMinor: 50_000,
  currency: 'INR',
  archivedAt: null,
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('assembleFinanceCoachPayload', () => {
  it('aggregates accounts, goals, budgets, health read, and projection with no raw transaction list', () => {
    const payload = assembleFinanceCoachPayload(
      [account],
      [txn({})],
      [],
      [goal],
      [budget],
      [category],
      [],
      '2026-07-19',
    );

    expect(payload.currency).toBe('INR');
    expect(payload.netWorthMinor).toBe(490_000); // opening 500,000 minus the 10,000 expense
    expect(payload.month).toEqual({ incomeMinor: 0, expenseMinor: 10_000 });
    expect(payload.topExpenseCategories).toEqual([{ categoryName: 'Food', totalMinor: 10_000 }]);
    expect(payload.accounts).toEqual([{ name: 'Bank', type: 'bank', balanceMinor: 490_000, isLiability: false }]);
    expect(payload.goals).toEqual([
      { name: 'House fund', targetAmountMinor: 1_000_000, savedMinor: 490_000, targetDate: '2027-01-01' },
    ]);
    expect(payload.budgets).toEqual([{ categoryName: 'Food', budgetedMinor: 50_000, spentMinor: 10_000 }]);
    expect(payload.healthRead.status).toBeDefined();
    expect(payload.projection).toHaveLength(3);
    // No recurring rules, so the balance never moves after today: the low point
    // is the current ledger balance, on day one of the horizon.
    expect(payload.cashflow).toEqual({
      status: 'clear',
      lowBalanceMinor: 490_000,
      lowDate: '2026-07-19',
      horizonDays: 30,
    });
    expect(payload).not.toHaveProperty('transactions');
  });

  it('excludes archived accounts and inactive goals', () => {
    const archivedAccount: Account = { ...account, externalId: 'acc-old', archivedAt: '2026-01-01T00:00:00.000Z' };
    const archivedGoal: FinanceGoal = { ...goal, externalId: 'g-old', status: 'archived' };
    const payload = assembleFinanceCoachPayload(
      [account, archivedAccount],
      [],
      [],
      [goal, archivedGoal],
      [],
      [category],
      [],
      '2026-07-19',
    );
    expect(payload.accounts).toHaveLength(1);
    expect(payload.goals).toHaveLength(1);
  });
});
