import {
  alignPayoffSeries,
  buildDebtOverview,
  iouPosition,
  paidInCycle,
  payoffOrder,
  simulatePayoff,
  statementCycle,
  type DebtLine,
} from '../debt';
import type { Account, AccountValuation, Iou, Transaction } from '../types';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'card-a',
    externalId: 'card-a',
    name: 'Card A',
    type: 'credit_card',
    balanceMode: 'ledger',
    isLiability: true,
    currency: 'INR',
    openingBalanceMinor: 0,
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

function payment(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'p1',
    externalId: 'p1',
    type: 'transfer',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: 'card-a',
    categoryExternalId: null,
    amountMinor: 100000,
    currency: 'INR',
    note: 'Card payment',
    txnDate: '2026-08-10',
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

const TODAY = '2026-08-15';

describe('statementCycle', () => {
  it('falls back to the calendar month when no due day is set', () => {
    expect(statementCycle(null, TODAY)).toEqual({ start: '2026-08-01', due: '2026-08-31' });
  });

  it('ends on this month’s due day when it is still ahead', () => {
    // Due on the 20th, today is the 15th — the cycle runs from the 21st of July.
    expect(statementCycle(20, TODAY)).toEqual({ start: '2026-07-21', due: '2026-08-20' });
  });

  it('rolls to next month once this month’s due day has passed', () => {
    // Due on the 5th, today is the 15th — that cycle closed, the next ends Sep 5.
    expect(statementCycle(5, TODAY)).toEqual({ start: '2026-08-06', due: '2026-09-05' });
  });

  it('treats the due day itself as still inside the closing cycle', () => {
    expect(statementCycle(15, TODAY).due).toBe('2026-08-15');
  });

  it('clamps a 31st due day into February', () => {
    // 2026 is not a leap year.
    expect(statementCycle(31, '2026-02-10')).toEqual({ start: '2026-02-01', due: '2026-02-28' });
  });

  it('crosses a year boundary', () => {
    expect(statementCycle(5, '2026-12-20')).toEqual({ start: '2026-12-06', due: '2027-01-05' });
  });

  it('produces cycles that abut without overlapping', () => {
    const closing = statementCycle(5, '2026-08-03'); // ends 2026-08-05
    const next = statementCycle(5, '2026-08-15'); // starts 2026-08-06
    expect(closing.due).toBe('2026-08-05');
    expect(next.start).toBe('2026-08-06');
  });
});

describe('paidInCycle', () => {
  const cycle = { start: '2026-08-06', due: '2026-09-05' };

  it('sums transfers into the account within the cycle', () => {
    const txns = [payment({ externalId: 'a', amountMinor: 60000, txnDate: '2026-08-10' }), payment({ externalId: 'b', amountMinor: 40000, txnDate: '2026-09-01' })];
    expect(paidInCycle('card-a', txns, cycle)).toBe(100000);
  });

  it('ignores transfers outside the cycle', () => {
    expect(paidInCycle('card-a', [payment({ txnDate: '2026-08-05' })], cycle)).toBe(0);
  });

  it('ignores a transfer OUT of the card — that is a cash advance, not a payment', () => {
    const out = payment({ accountExternalId: 'card-a', counterAccountExternalId: 'acc-bank' });
    expect(paidInCycle('card-a', [out], cycle)).toBe(0);
  });

  it('ignores an ordinary expense charged to the card', () => {
    const spend = payment({ type: 'expense', accountExternalId: 'card-a', counterAccountExternalId: null, categoryExternalId: 'sys-exp-food' });
    expect(paidInCycle('card-a', [spend], cycle)).toBe(0);
  });
});

describe('payoffOrder', () => {
  function line(externalId: string, balanceMinor: number, aprPct: number | null): DebtLine {
    return {
      account: account({ id: externalId, externalId }),
      balanceMinor,
      aprPct,
      minimumPaymentMinor: null,
      creditLimitMinor: null,
      utilizationPct: null,
      cycle: { start: '2026-08-01', due: '2026-08-31' },
      paidThisCycleMinor: 0,
      cycleStatus: 'no_minimum',
    };
  }

  const high = line('high', 2000000, 36);
  const low = line('low', 500000, 12);

  it('avalanche puts the highest APR first', () => {
    expect(payoffOrder([low, high], 'avalanche').map((l) => l.account.externalId)).toEqual(['high', 'low']);
  });

  it('snowball puts the smallest balance first', () => {
    expect(payoffOrder([high, low], 'snowball').map((l) => l.account.externalId)).toEqual(['low', 'high']);
  });

  it('sorts an unknown APR last under avalanche rather than treating it as 0%', () => {
    const unknown = line('unknown', 100, null);
    expect(payoffOrder([unknown, low], 'avalanche').map((l) => l.account.externalId)).toEqual(['low', 'unknown']);
  });

  it('breaks ties deterministically by externalId', () => {
    const a = line('aaa', 100000, 20);
    const b = line('bbb', 100000, 20);
    expect(payoffOrder([b, a], 'avalanche').map((l) => l.account.externalId)).toEqual(['aaa', 'bbb']);
    expect(payoffOrder([b, a], 'snowball').map((l) => l.account.externalId)).toEqual(['aaa', 'bbb']);
  });

  it('sorts cleared debts last even when they would otherwise rank first', () => {
    const cleared = line('cleared', 0, 99);
    expect(payoffOrder([cleared, low], 'avalanche').map((l) => l.account.externalId)).toEqual(['low', 'cleared']);
    // …and under snowball, where a zero balance is the smallest of all.
    expect(payoffOrder([cleared, low], 'snowball').map((l) => l.account.externalId)).toEqual(['low', 'cleared']);
  });
});

describe('buildDebtOverview', () => {
  const cardA = account({
    id: 'card-a',
    externalId: 'card-a',
    name: 'Card A',
    interestRate: 36,
    minimumPaymentMinor: 100000,
    dueDay: 20,
    creditLimitMinor: 5000000,
    openingBalanceMinor: 2000000,
  });
  const cardB = account({
    id: 'card-b',
    externalId: 'card-b',
    name: 'Card B',
    interestRate: 12,
    minimumPaymentMinor: 50000,
    dueDay: 20,
    openingBalanceMinor: 500000,
  });
  const loan = account({
    id: 'loan',
    externalId: 'loan',
    name: 'Car loan',
    type: 'loan',
    balanceMode: 'valuation',
    interestRate: 9,
  });
  const loanValuation: AccountValuation = {
    id: 'v1',
    externalId: 'v1',
    accountExternalId: 'loan',
    amountMinor: 8000000,
    asOfDate: '2026-08-01',
    source: 'manual',
    note: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  it('reads card balances from the ledger and loan balances from valuations', () => {
    const o = buildDebtOverview([cardA, loan], [], [loanValuation], TODAY, 'avalanche');
    const byId = new Map(o.lines.map((l) => [l.account.externalId, l]));
    expect(byId.get('card-a')!.balanceMinor).toBe(2000000);
    expect(byId.get('loan')!.balanceMinor).toBe(8000000);
    expect(o.cardCount).toBe(1);
    expect(o.loanCount).toBe(1);
  });

  it('totals what is outstanding and what the minimums add up to', () => {
    const o = buildDebtOverview([cardA, cardB, loan], [], [loanValuation], TODAY, 'avalanche');
    expect(o.totalOutstandingMinor).toBe(10500000); // 2,000,000 + 500,000 + 8,000,000
    expect(o.totalMinimumDueMinor).toBe(150000); // 100,000 + 50,000; the loan has none
  });

  it('ranks by strategy', () => {
    const avalanche = buildDebtOverview([cardB, cardA], [], [], TODAY, 'avalanche');
    expect(avalanche.lines[0].account.externalId).toBe('card-a'); // 36% APR
    const snowball = buildDebtOverview([cardB, cardA], [], [], TODAY, 'snowball');
    expect(snowball.lines[0].account.externalId).toBe('card-b'); // ₹5,000 balance
  });

  it('computes utilization only when a limit is set', () => {
    const o = buildDebtOverview([cardA, cardB], [], [], TODAY, 'avalanche');
    const byId = new Map(o.lines.map((l) => [l.account.externalId, l]));
    expect(byId.get('card-a')!.utilizationPct).toBe(40); // 2,000,000 of 5,000,000
    expect(byId.get('card-b')!.utilizationPct).toBeNull();
  });

  it('marks a debt paid once the minimum is covered, and counts it', () => {
    // Due day 20 and today the 15th → cycle is 2026-07-21..2026-08-20.
    const o = buildDebtOverview([cardA], [payment({ amountMinor: 100000, txnDate: '2026-08-10' })], [], TODAY, 'avalanche');
    expect(o.lines[0].paidThisCycleMinor).toBe(100000);
    expect(o.lines[0].cycleStatus).toBe('paid');
    expect(o.paidCount).toBe(1);
  });

  it('marks a short payment partial', () => {
    const o = buildDebtOverview([cardA], [payment({ amountMinor: 40000, txnDate: '2026-08-10' })], [], TODAY, 'avalanche');
    expect(o.lines[0].cycleStatus).toBe('partial');
    expect(o.paidCount).toBe(0);
  });

  it('marks an untouched cycle unpaid', () => {
    expect(buildDebtOverview([cardA], [], [], TODAY, 'avalanche').lines[0].cycleStatus).toBe('unpaid');
  });

  it('reports no_minimum when none is set', () => {
    expect(buildDebtOverview([loan], [], [loanValuation], TODAY, 'avalanche').lines[0].cycleStatus).toBe('no_minimum');
  });

  it('reduces the card balance when a payment lands', () => {
    const o = buildDebtOverview([cardA], [payment({ amountMinor: 500000, txnDate: '2026-08-10' })], [], TODAY, 'avalanche');
    expect(o.lines[0].balanceMinor).toBe(1500000); // 2,000,000 owed − 500,000 paid
  });

  it('excludes archived debts and non-debt accounts', () => {
    const archived = account({ id: 'old', externalId: 'old', archivedAt: '2026-01-01T00:00:00.000Z' });
    const bank = account({ id: 'bank', externalId: 'bank', type: 'bank', isLiability: false, openingBalanceMinor: 900000 });
    const o = buildDebtOverview([cardA, archived, bank], [], [], TODAY, 'avalanche');
    expect(o.lines).toHaveLength(1);
    expect(o.lines[0].account.externalId).toBe('card-a');
  });

  it('returns an empty overview when there is no debt', () => {
    const o = buildDebtOverview([], [], [], TODAY, 'avalanche');
    expect(o).toEqual({
      lines: [],
      totalOutstandingMinor: 0,
      totalMinimumDueMinor: 0,
      paidCount: 0,
      cardCount: 0,
      loanCount: 0,
    });
  });
});

describe('iouPosition', () => {
  function iou(overrides: Partial<Iou>): Iou {
    return {
      id: 'i1',
      externalId: 'i1',
      personName: 'Sam',
      direction: 'owed_to_me',
      amountMinor: 50000,
      currency: 'INR',
      note: null,
      incurredDate: '2026-08-01',
      dueDate: null,
      settledAt: null,
      updatedAt: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('nets what you are owed against what you owe', () => {
    const position = iouPosition([
      iou({ externalId: 'a', direction: 'owed_to_me', amountMinor: 80000 }),
      iou({ externalId: 'b', direction: 'i_owe', amountMinor: 30000 }),
    ]);
    expect(position).toEqual({ netMinor: 50000, owedToMeMinor: 80000, iOweMinor: 30000, openCount: 2 });
  });

  it('goes negative when you owe more than you are owed', () => {
    expect(iouPosition([iou({ direction: 'i_owe', amountMinor: 20000 })]).netMinor).toBe(-20000);
  });

  it('excludes settled IOUs from every total', () => {
    const position = iouPosition([
      iou({ externalId: 'a', amountMinor: 80000, settledAt: '2026-08-09T00:00:00.000Z' }),
      iou({ externalId: 'b', amountMinor: 10000 }),
    ]);
    expect(position).toEqual({ netMinor: 10000, owedToMeMinor: 10000, iOweMinor: 0, openCount: 1 });
  });

  it('is all zeroes with nothing outstanding', () => {
    expect(iouPosition([])).toEqual({ netMinor: 0, owedToMeMinor: 0, iOweMinor: 0, openCount: 0 });
  });
});

describe('simulatePayoff', () => {
  function line(externalId: string, balanceMinor: number, aprPct: number | null, minimumMinor: number | null): DebtLine {
    return {
      account: account({ id: externalId, externalId }),
      balanceMinor,
      aprPct,
      minimumPaymentMinor: minimumMinor,
      creditLimitMinor: null,
      utilizationPct: null,
      cycle: { start: '2026-08-01', due: '2026-08-31' },
      paidThisCycleMinor: 0,
      cycleStatus: 'unpaid',
    };
  }

  // ₹20,000 at 36% and ₹5,000 at 12%, ₹1,000 + ₹500 minimums.
  const expensive = line('expensive', 2000000, 36, 100000);
  const small = line('small', 500000, 12, 50000);

  it('clears an interest-free debt in exactly the arithmetic number of months', () => {
    // ₹10,000 at 0% APR with a ₹2,000 budget → 5 months.
    const plan = simulatePayoff([line('free', 1000000, 0, 100000)], 200000, 'avalanche', '2026-08-15')!;
    expect(plan.months).toBe(5);
    expect(plan.totalInterestMinor).toBe(0);
    expect(plan.debtFreeDate).toBe('2027-01-15');
    expect(plan.order).toEqual(['free']);
  });

  it('reports the total balance declining to zero month by month, starting from month 0', () => {
    const plan = simulatePayoff([line('free', 1000000, 0, 100000)], 200000, 'avalanche', '2026-08-15')!;
    expect(plan.balanceByMonth).toEqual([
      { month: 0, totalBalanceMinor: 1000000 },
      { month: 1, totalBalanceMinor: 800000 },
      { month: 2, totalBalanceMinor: 600000 },
      { month: 3, totalBalanceMinor: 400000 },
      { month: 4, totalBalanceMinor: 200000 },
      { month: 5, totalBalanceMinor: 0 },
    ]);
  });

  it('sums the balance across every debt still active that month', () => {
    const plan = simulatePayoff([expensive, small], 300000, 'avalanche', '2026-08-15')!;
    expect(plan.balanceByMonth[0].totalBalanceMinor).toBe(expensive.balanceMinor + small.balanceMinor);
    expect(plan.balanceByMonth[plan.balanceByMonth.length - 1].totalBalanceMinor).toBe(0);
    expect(plan.balanceByMonth).toHaveLength(plan.months + 1);
  });

  it('avalanche costs less interest than snowball on the same debts and budget', () => {
    const budget = 300000; // ₹3,000/mo, above the ₹1,500 of minimums
    const avalanche = simulatePayoff([expensive, small], budget, 'avalanche', '2026-08-15')!;
    const snowball = simulatePayoff([expensive, small], budget, 'snowball', '2026-08-15')!;
    expect(avalanche.totalInterestMinor).toBeLessThan(snowball.totalInterestMinor);
  });

  it('snowball clears the smallest debt first', () => {
    const plan = simulatePayoff([expensive, small], 300000, 'snowball', '2026-08-15')!;
    expect(plan.order[0]).toBe('small');
  });

  it('avalanche clears the highest-rate debt first', () => {
    const plan = simulatePayoff([expensive, small], 300000, 'avalanche', '2026-08-15')!;
    expect(plan.order[0]).toBe('expensive');
  });

  it('returns null when the budget cannot cover the minimums', () => {
    expect(simulatePayoff([expensive, small], 100000, 'avalanche', '2026-08-15')).toBeNull();
  });

  it('returns null when any debt has no APR, rather than guessing one', () => {
    expect(simulatePayoff([line('unknown', 500000, null, 50000)], 300000, 'avalanche', '2026-08-15')).toBeNull();
  });

  it('returns null when there is nothing to pay off', () => {
    expect(simulatePayoff([], 300000, 'avalanche', '2026-08-15')).toBeNull();
    expect(simulatePayoff([line('cleared', 0, 20, 1000)], 300000, 'avalanche', '2026-08-15')).toBeNull();
  });

  it('returns null when interest outruns the budget and the plan never converges', () => {
    // ₹1,000,000 at 200% APR accrues far more each month than a ₹1,000 budget.
    expect(simulatePayoff([line('runaway', 100000000, 200, 100000)], 100000, 'avalanche', '2026-08-15')).toBeNull();
  });

  it('clamps the debt-free date into a short month', () => {
    // Starting Dec 31, three months out lands on Mar 31 — but one month lands on Jan 31.
    const plan = simulatePayoff([line('free', 200000, 0, 100000)], 100000, 'avalanche', '2026-12-31')!;
    expect(plan.months).toBe(2);
    expect(plan.debtFreeDate).toBe('2027-02-28');
  });
});

describe('alignPayoffSeries', () => {
  it('right-pads the shorter series with its final balance so both span the same x-axis', () => {
    const short = [
      { month: 0, totalBalanceMinor: 100000 },
      { month: 1, totalBalanceMinor: 0 },
    ];
    const long = [
      { month: 0, totalBalanceMinor: 100000 },
      { month: 1, totalBalanceMinor: 60000 },
      { month: 2, totalBalanceMinor: 20000 },
      { month: 3, totalBalanceMinor: 0 },
    ];
    const { a, b } = alignPayoffSeries(short, long);
    expect(a).toEqual([
      { month: 0, totalBalanceMinor: 100000 },
      { month: 1, totalBalanceMinor: 0 },
      { month: 2, totalBalanceMinor: 0 },
      { month: 3, totalBalanceMinor: 0 },
    ]);
    expect(b).toEqual(long);
  });

  it('leaves two equal-length series untouched', () => {
    const a = [{ month: 0, totalBalanceMinor: 500 }];
    const b = [{ month: 0, totalBalanceMinor: 900 }];
    expect(alignPayoffSeries(a, b)).toEqual({ a, b });
  });
});
