import { accountBalanceAsOf, accountNetWorthContribution, netWorthAsOf, netWorthSeries } from '../netWorth';
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
    creditLimitMinor: null,
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

describe('accountBalanceAsOf — ledger-mode liabilities', () => {
  const card = account({
    id: 'card',
    externalId: 'card',
    type: 'credit_card',
    balanceMode: 'ledger',
    isLiability: true,
    openingBalanceMinor: 50000, // ₹500 already owed
    creditLimitMinor: 1000000,
  });

  function cardTxn(overrides: Partial<Transaction>): Transaction {
    return {
      id: 't',
      externalId: 't',
      type: 'expense',
      accountExternalId: 'card',
      counterAccountExternalId: null,
      categoryExternalId: 'sys-exp-food',
      amountMinor: 10000,
      currency: 'INR',
      note: null,
      txnDate: '2026-08-05',
      source: 'manual',
      recurrenceExternalId: null,
      updatedAt: '2026-08-05T00:00:00.000Z',
      ...overrides,
    };
  }

  it('increases what you owe when you spend on the card', () => {
    // 50,000 owed + 10,000 spent = 60,000 owed, reported positive.
    expect(accountBalanceAsOf(card, [cardTxn({})], [], '2026-08-31')).toBe(60000);
  });

  it('reduces what you owe when a payment transfers in', () => {
    const payment = cardTxn({
      externalId: 'pay',
      type: 'transfer',
      categoryExternalId: null,
      accountExternalId: 'bank',
      counterAccountExternalId: 'card',
      amountMinor: 20000,
    });
    // 50,000 owed − 20,000 paid = 30,000.
    expect(accountBalanceAsOf(card, [payment], [], '2026-08-31')).toBe(30000);
  });

  it('drives net worth down as card debt grows', () => {
    const bare = account({ id: 'c2', externalId: 'c2', type: 'credit_card', balanceMode: 'ledger', isLiability: true, openingBalanceMinor: 0 });
    const spend = cardTxn({ accountExternalId: 'c2', amountMinor: 30000 });
    expect(netWorthAsOf([bare], [spend], [], '2026-08-31')).toBe(-30000);
  });

  it('leaves asset ledger accounts untouched', () => {
    const bank = account({ id: 'b', externalId: 'b', type: 'bank', isLiability: false, openingBalanceMinor: 100000 });
    const spend = cardTxn({ accountExternalId: 'b', amountMinor: 30000 });
    expect(accountBalanceAsOf(bank, [spend], [], '2026-08-31')).toBe(70000);
  });
});
