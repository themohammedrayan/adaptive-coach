jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest').default,
);

const mockUpsertTransaction = jest.fn();
jest.mock('../api', () => ({
  deleteAccount: jest.fn(),
  deleteRecurringTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
  upsertAccount: jest.fn(),
  upsertBudget: jest.fn(),
  upsertCategory: jest.fn(),
  upsertGoal: jest.fn(),
  upsertIou: jest.fn(),
  upsertRecurringTransaction: jest.fn(),
  upsertTransaction: (...args: unknown[]) => mockUpsertTransaction(...args),
  upsertValuation: jest.fn(),
}));

import { clearOutbox, enqueueOutbox, flushOutbox, isPoisoned, OUTBOX_POISON_THRESHOLD, readOutbox } from '../outbox';
import type { Transaction } from '../types';

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    externalId: 't1',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: null,
    amountMinor: 1000,
    currency: 'INR',
    note: null,
    txnDate: '2026-08-01',
    source: 'manual',
    recurrenceExternalId: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await clearOutbox();
  mockUpsertTransaction.mockReset();
});

describe('enqueueOutbox', () => {
  it('replaces an existing entry in place rather than moving it to the end', async () => {
    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn({ externalId: 'a' }), queuedAt: 't1' });
    await enqueueOutbox({ entityType: 'transaction', externalId: 'b', payload: txn({ externalId: 'b' }), queuedAt: 't2' });
    await enqueueOutbox({
      entityType: 'transaction',
      externalId: 'a',
      payload: txn({ externalId: 'a', note: 'edited' }),
      queuedAt: 't3',
    });

    const entries = await readOutbox();
    // 'a' keeps its original (first) position even though it was re-queued last —
    // a re-edited create must not get sequenced behind entries that depend on it.
    expect(entries.map((e) => e.externalId)).toEqual(['a', 'b']);
    expect((entries[0].payload as Transaction).note).toBe('edited');
  });

  it('resets attempts when an entity is re-queued with fresh content', async () => {
    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn(), queuedAt: 't1' });
    mockUpsertTransaction.mockRejectedValue(new Error('offline'));
    await flushOutbox();
    expect((await readOutbox())[0].attempts).toBe(1);

    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn(), queuedAt: 't2' });
    expect((await readOutbox())[0].attempts).toBe(0);
  });
});

describe('flushOutbox', () => {
  it('removes an entry once its replay succeeds', async () => {
    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn(), queuedAt: 't1' });
    mockUpsertTransaction.mockResolvedValue(undefined);
    await flushOutbox();
    expect(await readOutbox()).toEqual([]);
  });

  it('records a failed attempt and keeps the entry queued for the next flush', async () => {
    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn(), queuedAt: 't1' });
    mockUpsertTransaction.mockRejectedValue(new Error('offline'));
    await flushOutbox();

    const entries = await readOutbox();
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(1);
    expect(entries[0].lastError).toBe('offline');
  });

  it('is single-flight: overlapping calls replay each entry only once', async () => {
    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn(), queuedAt: 't1' });
    let resolveUpsert: () => void = () => {};
    let signalCalled: () => void = () => {};
    const called = new Promise<void>((resolve) => {
      signalCalled = resolve;
    });
    mockUpsertTransaction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpsert = resolve;
          signalCalled();
        }),
    );

    const first = flushOutbox();
    const second = flushOutbox(); // arrives while `first` is still mid-flight
    expect(second).toBe(first);
    await called; // wait until the in-flight replay has actually captured resolveUpsert
    resolveUpsert();
    await Promise.all([first, second]);

    expect(mockUpsertTransaction).toHaveBeenCalledTimes(1);
  });

  it('stops retrying an entry once it crosses the poison threshold, but keeps it queued and surfaced', async () => {
    await enqueueOutbox({ entityType: 'transaction', externalId: 'a', payload: txn(), queuedAt: 't1' });
    mockUpsertTransaction.mockRejectedValue(new Error('permanently broken'));

    for (let i = 0; i < OUTBOX_POISON_THRESHOLD; i++) {
      await flushOutbox();
    }
    const poisoned = (await readOutbox())[0];
    expect(poisoned.attempts).toBe(OUTBOX_POISON_THRESHOLD);
    expect(isPoisoned(poisoned)).toBe(true);

    mockUpsertTransaction.mockClear();
    await flushOutbox();
    expect(mockUpsertTransaction).not.toHaveBeenCalled();
    expect(await readOutbox()).toHaveLength(1);
  });
});
