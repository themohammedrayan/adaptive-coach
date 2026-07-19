import { accountNetWorthContribution, netWorthAsOf, netWorthSeries } from '../netWorth';
import type { Account, AccountValuation, Transaction } from '../types';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'a1',
    externalId: 'a1',
    name: 'Account',
    type: 'bank',
    balanceMode: 'ledger',
    isLiability: false,
    currency: 'INR',
    openingBalanceMinor: 0,
    openingDate: '2026-01-01',
    interestRate: null,
    minimumPaymentMinor: null,
    dueDay: null,
    source: 'manual',
    archivedAt: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('accountNetWorthContribution', () => {
  it('an asset account contributes its balance as-is', () => {
    expect(accountNetWorthContribution(account({ isLiability: false }), 5000)).toBe(5000);
  });

  it('a liability account contributes the negative of its balance — the one sign flip', () => {
    expect(accountNetWorthContribution(account({ isLiability: true }), 5000)).toBe(-5000);
  });

  it('contributes 0 for a valuation account with no entry yet', () => {
    expect(accountNetWorthContribution(account({ isLiability: true }), null)).toBe(0);
  });
});

describe('netWorthAsOf', () => {
  const bank = account({ id: 'bank', externalId: 'bank', type: 'bank', balanceMode: 'ledger', isLiability: false, openingBalanceMinor: 100000 });
  const loan = account({ id: 'loan', externalId: 'loan', type: 'loan', balanceMode: 'valuation', isLiability: true });
  const investment = account({ id: 'invest', externalId: 'invest', type: 'investment', balanceMode: 'valuation', isLiability: false });
  const archived = account({ id: 'old', externalId: 'old', archivedAt: '2026-06-01T00:00:00.000Z', openingBalanceMinor: 999999 });

  const transactions: Transaction[] = [];
  const valuations: AccountValuation[] = [
    {
      id: 'v1',
      externalId: 'v1',
      accountExternalId: 'loan',
      amountMinor: 40000, // entered positive, "amount owed"
      asOfDate: '2026-07-01',
      source: 'manual',
      note: null,
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'v2',
      externalId: 'v2',
      accountExternalId: 'invest',
      amountMinor: 250000,
      asOfDate: '2026-07-01',
      source: 'manual',
      note: null,
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  ];

  it('sums ledger + valuation accounts, subtracting the loan, excluding archived accounts', () => {
    const accounts = [bank, loan, investment, archived];
    // 100000 (bank) - 40000 (loan) + 250000 (investment) = 310000
    expect(netWorthAsOf(accounts, transactions, valuations, '2026-07-15')).toBe(310000);
  });

  it('a date before any valuation exists excludes those accounts (0 contribution)', () => {
    const accounts = [bank, loan, investment];
    expect(netWorthAsOf(accounts, transactions, valuations, '2026-06-01')).toBe(100000);
  });
});

describe('netWorthSeries', () => {
  it('samples netWorthAsOf at each given date', () => {
    const accounts = [account({ id: 'bank', externalId: 'bank', openingBalanceMinor: 1000 })];
    const series = netWorthSeries(accounts, [], [], ['2026-06-30', '2026-07-31']);
    expect(series).toEqual([
      { date: '2026-06-30', netWorthMinor: 1000 },
      { date: '2026-07-31', netWorthMinor: 1000 },
    ]);
  });
});
