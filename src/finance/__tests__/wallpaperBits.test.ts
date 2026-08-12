jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest').default,
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { writeFinanceCache, type FinanceCache } from '../cache';
import { clearPeakDebt, computeFinanceWallpaperBits } from '../wallpaperBits';
import type { Account, Transaction } from '../types';

const EMPTY_CACHE: FinanceCache = {
  accounts: [],
  categories: [],
  transactions: [],
  valuations: [],
  recurringTransactions: [],
  goals: [],
  budgets: [],
  ious: [],
  cachedAt: '2026-08-01T00:00:00.000Z',
};

function card(overrides: Partial<Account> = {}): Account {
  return {
    id: 'card',
    externalId: 'card',
    name: 'Card',
    type: 'credit_card',
    balanceMode: 'ledger',
    isLiability: true,
    currency: 'INR',
    openingBalanceMinor: 0,
    openingDate: '2026-01-01',
    interestRate: 36,
    minimumPaymentMinor: 100000,
    dueDay: 20,
    creditLimitMinor: 1000000,
    source: 'manual',
    archivedAt: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function charge(accountExternalId: string, amountMinor: number, txnDate: string): Transaction {
  return {
    id: `t-${accountExternalId}-${txnDate}`,
    externalId: `t-${accountExternalId}-${txnDate}`,
    type: 'expense',
    accountExternalId,
    counterAccountExternalId: null,
    categoryExternalId: null,
    amountMinor,
    currency: 'INR',
    note: null,
    txnDate,
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: `${txnDate}T00:00:00.000Z`,
  };
}

/** A payment: a transfer landing on the card, matching how AddTransactionModal logs "pay X" in practice. */
function payment(toAccountExternalId: string, amountMinor: number, txnDate: string): Transaction {
  return {
    id: `p-${toAccountExternalId}-${txnDate}`,
    externalId: `p-${toAccountExternalId}-${txnDate}`,
    type: 'transfer',
    accountExternalId: 'bank',
    counterAccountExternalId: toAccountExternalId,
    categoryExternalId: null,
    amountMinor,
    currency: 'INR',
    note: null,
    txnDate,
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: `${txnDate}T00:00:00.000Z`,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearPeakDebt();
});

describe('computeFinanceWallpaperBits', () => {
  it('returns null when nothing has been cached yet', async () => {
    expect(await computeFinanceWallpaperBits('2026-08-15')).toBeNull();
  });

  it('returns null when there are no debt accounts', async () => {
    await writeFinanceCache({ ...EMPTY_CACHE, accounts: [card({ type: 'bank', isLiability: false })] });
    expect(await computeFinanceWallpaperBits('2026-08-15')).toBeNull();
  });

  it('returns null when every debt is fully paid off', async () => {
    await writeFinanceCache({ ...EMPTY_CACHE, accounts: [card()] });
    expect(await computeFinanceWallpaperBits('2026-08-15')).toBeNull();
  });

  it('sets payoffPct to 0 the first time debt is seen, since peak equals current', async () => {
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card()],
      transactions: [charge('card', 500000, '2026-08-01')],
    });
    const bits = await computeFinanceWallpaperBits('2026-08-15');
    expect(bits?.payoffPct).toBe(0);
  });

  it('ratchets the peak so payoffPct reflects progress after the balance later drops', async () => {
    // First read at ₹10,000 outstanding establishes the peak.
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card()],
      transactions: [charge('card', 1000000, '2026-08-01')],
    });
    await computeFinanceWallpaperBits('2026-08-15');

    // Balance drops to ₹4,000 (a payment) — peak stays at ₹10,000, so 60% paid off.
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card()],
      transactions: [charge('card', 1000000, '2026-08-01'), payment('card', 600000, '2026-08-10')],
    });
    const bits = await computeFinanceWallpaperBits('2026-08-20');
    expect(bits?.payoffPct).toBeCloseTo(0.6);
  });

  it('never lets the peak shrink, even if a later balance is temporarily higher then drops back', async () => {
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card()],
      transactions: [charge('card', 1000000, '2026-08-01')],
    });
    await computeFinanceWallpaperBits('2026-08-05'); // peak = 1,000,000

    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card()],
      transactions: [charge('card', 2000000, '2026-08-01')],
    });
    await computeFinanceWallpaperBits('2026-08-10'); // peak = 2,000,000

    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card()],
      transactions: [charge('card', 500000, '2026-08-01')],
    });
    const bits = await computeFinanceWallpaperBits('2026-08-15');
    // 500,000 outstanding against a 2,000,000 peak, not the smaller earlier peak.
    expect(bits?.payoffPct).toBeCloseTo(0.75);
  });

  it('picks the soonest due date across multiple outstanding debts', async () => {
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card({ externalId: 'soon', id: 'soon', dueDay: 18 }), card({ externalId: 'later', id: 'later', dueDay: 28 })],
      transactions: [charge('soon', 500000, '2026-08-01'), charge('later', 500000, '2026-08-01')],
    });
    const bits = await computeFinanceWallpaperBits('2026-08-15');
    expect(bits?.nextDueDays).toBe(3);
  });

  it('projects daysToFreedom from the avalanche plan at the combined minimums', async () => {
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card({ interestRate: 0, minimumPaymentMinor: 200000 })],
      transactions: [charge('card', 1000000, '2026-08-01')],
    });
    const bits = await computeFinanceWallpaperBits('2026-08-15');
    // ₹10,000 at 0% APR, paid at exactly the ₹2,000 minimum → 5 months.
    expect(bits?.daysToFreedom).not.toBeNull();
    expect(bits?.daysToFreedom).toBeGreaterThan(0);
  });

  it('leaves daysToFreedom null when a debt has no APR set, rather than guessing', async () => {
    await writeFinanceCache({
      ...EMPTY_CACHE,
      accounts: [card({ interestRate: null })],
      transactions: [charge('card', 1000000, '2026-08-01')],
    });
    const bits = await computeFinanceWallpaperBits('2026-08-15');
    expect(bits?.daysToFreedom).toBeNull();
  });
});
