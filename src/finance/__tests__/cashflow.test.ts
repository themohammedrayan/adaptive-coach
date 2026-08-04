import { assessCashflow, projectCashflow } from '../cashflow';
import type { Account, RecurringTransaction, Transaction } from '../types';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'acc-bank',
    externalId: 'acc-bank',
    name: 'Bank',
    type: 'bank',
    balanceMode: 'ledger',
    isLiability: false,
    currency: 'INR',
    openingBalanceMinor: 10000000, // ₹100,000
    openingDate: '2026-01-01',
    interestRate: null,
    minimumPaymentMinor: null,
    dueDay: null,
    creditLimitMinor: null,
    source: 'manual',
    archivedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    externalId: 't1',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: 'sys-exp-food',
    amountMinor: 100000, // ₹1,000
    currency: 'INR',
    note: 'Groceries',
    txnDate: '2026-08-05',
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

function rule(overrides: Partial<RecurringTransaction>): RecurringTransaction {
  return {
    id: 'r-rent',
    externalId: 'r-rent',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: 'sys-exp-rent',
    amountMinor: 2000000, // ₹20,000
    currency: 'INR',
    note: 'Rent',
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 10,
    startDate: '2026-06-10',
    endDate: null,
    lastMaterializedDate: '2026-07-10',
    active: true,
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

const BASE = {
  today: '2026-08-01' as const,
  startDate: '2026-08-01' as const,
  endDate: '2026-08-31' as const,
};

describe('projectCashflow — balances', () => {
  it('opens at the ledger balance and stays flat with no events', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.openingBalanceMinor).toBe(10000000);
    expect(p.days).toHaveLength(31); // August
    expect(p.days[30].closingBalanceMinor).toBe(10000000);
    expect(p.low).toEqual({ date: '2026-08-01', balanceMinor: 10000000 });
  });

  it('sums opening balances across every pooled account', () => {
    const p = projectCashflow({
      accounts: [account({}), account({ id: 'acc-cash', externalId: 'acc-cash', type: 'cash', openingBalanceMinor: 500000 })],
      transactions: [],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.openingBalanceMinor).toBe(10500000); // 10,000,000 + 500,000
  });

  it('carries a running balance forward across a forecast occurrence', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [rule({})],
      ...BASE,
    });
    const aug10 = p.days.find((d) => d.date === '2026-08-10')!;
    expect(aug10.events).toHaveLength(1);
    expect(aug10.events[0].kind).toBe('forecast');
    expect(aug10.netDeltaMinor).toBe(-2000000);
    expect(aug10.closingBalanceMinor).toBe(8000000); // 10,000,000 − 2,000,000
    // and it stays down for the rest of the month
    expect(p.days[30].closingBalanceMinor).toBe(8000000);
  });

  it('reflects a past-dated transaction in the opening balance, not as an event', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [txn({ txnDate: '2026-07-20' })],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.openingBalanceMinor).toBe(9900000); // 10,000,000 − 100,000
    expect(p.days.every((d) => d.events.length === 0)).toBe(true);
  });

  it('records income as a positive delta', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [txn({ type: 'income', categoryExternalId: 'sys-inc-salary', amountMinor: 5000000, txnDate: '2026-08-03' })],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.days.find((d) => d.date === '2026-08-03')!.netDeltaMinor).toBe(5000000);
  });

  it('applies an adjustment with its stored sign', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [txn({ type: 'adjustment', categoryExternalId: null, amountMinor: -250000, txnDate: '2026-08-04' })],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.days.find((d) => d.date === '2026-08-04')!.netDeltaMinor).toBe(-250000);
  });
});

describe('projectCashflow — the spendable pool', () => {
  it('nets a transfer between two pooled accounts to zero and hides it', () => {
    const p = projectCashflow({
      accounts: [account({}), account({ id: 'acc-cash', externalId: 'acc-cash', type: 'cash', openingBalanceMinor: 0 })],
      transactions: [
        txn({ type: 'transfer', categoryExternalId: null, counterAccountExternalId: 'acc-cash', amountMinor: 300000, txnDate: '2026-08-06' }),
      ],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.days.find((d) => d.date === '2026-08-06')!.events).toEqual([]);
    expect(p.days[30].closingBalanceMinor).toBe(10000000); // pool total unchanged
  });

  it('treats a transfer out to a credit card as cash leaving the pool', () => {
    const p = projectCashflow({
      accounts: [account({}), account({ id: 'acc-cc', externalId: 'acc-cc', type: 'credit_card', isLiability: true, openingBalanceMinor: 0 })],
      transactions: [
        txn({ type: 'transfer', categoryExternalId: null, counterAccountExternalId: 'acc-cc', amountMinor: 300000, txnDate: '2026-08-06' }),
      ],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.days.find((d) => d.date === '2026-08-06')!.netDeltaMinor).toBe(-300000);
  });

  it('ignores spending on a credit card, which is not cash', () => {
    const p = projectCashflow({
      accounts: [account({}), account({ id: 'acc-cc', externalId: 'acc-cc', type: 'credit_card', isLiability: true, openingBalanceMinor: 0 })],
      transactions: [txn({ accountExternalId: 'acc-cc', txnDate: '2026-08-06' })],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.days.find((d) => d.date === '2026-08-06')!.events).toEqual([]);
  });

  it('excludes archived and valuation-mode accounts from the pool', () => {
    const p = projectCashflow({
      accounts: [
        account({ archivedAt: '2026-07-01T00:00:00.000Z' }),
        account({ id: 'acc-inv', externalId: 'acc-inv', type: 'investment', balanceMode: 'valuation', openingBalanceMinor: 9999999 }),
      ],
      transactions: [],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.openingBalanceMinor).toBe(0);
  });

  it('still returns a full day grid when there are no accounts at all', () => {
    const p = projectCashflow({ accounts: [], transactions: [], recurringTransactions: [], ...BASE });
    expect(p.openingBalanceMinor).toBe(0);
    expect(p.days).toHaveLength(31);
    expect(p.low).toEqual({ date: '2026-08-01', balanceMinor: 0 });
  });
});

describe('projectCashflow — double-count guards', () => {
  it('does not forecast an occurrence at or before lastMaterializedDate', () => {
    // Rule fires on the 10th; already materialized through Aug 10.
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [rule({ lastMaterializedDate: '2026-08-10' })],
      ...BASE,
    });
    expect(p.days.find((d) => d.date === '2026-08-10')!.events).toEqual([]);
    expect(p.days.find((d) => d.date === '2026-09-10')).toBeUndefined();
  });

  it('does not forecast an occurrence that already exists as a real row, even when the rule looks stale', () => {
    // The outbox window: the transaction write landed, the lastMaterializedDate
    // write did not — so guard 1 alone would re-emit Aug 10.
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [
        txn({
          externalId: 'materialized-aug',
          type: 'expense',
          categoryExternalId: 'sys-exp-rent',
          amountMinor: 2000000,
          txnDate: '2026-08-10',
          source: 'recurring',
          recurrenceExternalId: 'r-rent',
        }),
      ],
      recurringTransactions: [rule({ lastMaterializedDate: '2026-07-10' })],
      ...BASE,
    });
    const aug10 = p.days.find((d) => d.date === '2026-08-10')!;
    expect(aug10.events).toHaveLength(1);
    expect(aug10.events[0].kind).toBe('settled');
    expect(aug10.netDeltaMinor).toBe(-2000000); // charged once, not twice
  });
});

describe('projectCashflow — rule lifecycle', () => {
  it('skips inactive rules', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [rule({ active: false })],
      ...BASE,
    });
    expect(p.days.every((d) => d.events.length === 0)).toBe(true);
  });

  it('stops forecasting past the rule end date', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [rule({ endDate: '2026-08-05' })],
      ...BASE,
    });
    expect(p.days.every((d) => d.events.length === 0)).toBe(true);
  });

  it('forecasts a daily rule on every day of the window', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [
        rule({
          externalId: 'r-coffee',
          frequency: 'daily',
          interval: 1,
          dayOfMonth: null,
          amountMinor: 10000,
          startDate: '2026-08-01',
          lastMaterializedDate: null,
        }),
      ],
      ...BASE,
    });
    expect(p.days.every((d) => d.events.length === 1)).toBe(true);
    expect(p.days[30].closingBalanceMinor).toBe(10000000 - 31 * 10000);
  });
});

describe('projectCashflow — future windows', () => {
  it('catches up on bills between today and a later window, folding them into the opening balance', () => {
    // Viewing September while standing in August: the Aug 10 rent must already
    // be reflected in September's opening balance, not silently skipped.
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [],
      recurringTransactions: [rule({})],
      today: '2026-08-01',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(p.openingBalanceMinor).toBe(8000000); // 10,000,000 − Aug 10 rent
    expect(p.days).toHaveLength(30);
    expect(p.days.find((d) => d.date === '2026-09-10')!.netDeltaMinor).toBe(-2000000);
    expect(p.days[29].closingBalanceMinor).toBe(6000000); // both rents paid
  });
});

describe('projectCashflow — the low point', () => {
  it('picks the minimum closing balance', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [
        txn({ externalId: 'big', amountMinor: 9000000, txnDate: '2026-08-05' }),
        txn({ externalId: 'pay', type: 'income', categoryExternalId: 'sys-inc-salary', amountMinor: 9000000, txnDate: '2026-08-20' }),
      ],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.low).toEqual({ date: '2026-08-05', balanceMinor: 1000000 });
  });

  it('keeps the earliest date when the low is hit more than once', () => {
    const p = projectCashflow({
      accounts: [account({})],
      transactions: [
        txn({ externalId: 'a', amountMinor: 100000, txnDate: '2026-08-05' }),
        txn({ externalId: 'b', type: 'income', categoryExternalId: 'sys-inc-salary', amountMinor: 100000, txnDate: '2026-08-10' }),
        txn({ externalId: 'c', amountMinor: 100000, txnDate: '2026-08-15' }),
      ],
      recurringTransactions: [],
      ...BASE,
    });
    expect(p.low.date).toBe('2026-08-05');
  });
});

describe('assessCashflow', () => {
  const projectionWith = (transactions: Transaction[]) =>
    projectCashflow({ accounts: [account({})], transactions, recurringTransactions: [], ...BASE });

  it('reads clear when the low point stays well above the opening balance floor', () => {
    const outlook = assessCashflow(projectionWith([]));
    expect(outlook.status).toBe('clear');
    expect(outlook.lowBalanceMinor).toBe(10000000);
    expect(outlook.horizonDays).toBe(31);
  });

  it('reads tight when the low point falls under 10% of opening', () => {
    // 10,000,000 − 9,500,000 = 500,000, which is under the 1,000,000 threshold.
    const outlook = assessCashflow(projectionWith([txn({ amountMinor: 9500000, txnDate: '2026-08-05' })]));
    expect(outlook.status).toBe('tight');
    expect(outlook.lowDate).toBe('2026-08-05');
  });

  it('reads shortfall when the balance goes negative', () => {
    const outlook = assessCashflow(projectionWith([txn({ amountMinor: 11000000, txnDate: '2026-08-07' })]));
    expect(outlook.status).toBe('shortfall');
    expect(outlook.lowBalanceMinor).toBe(-1000000);
    expect(outlook.lowDate).toBe('2026-08-07');
  });
});
