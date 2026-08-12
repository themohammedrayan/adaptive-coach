import { materializeDueRecurrences, materializedTransactionExternalId } from '../recurrence';
import type { RecurringTransaction } from '../types';

function rule(overrides: Partial<RecurringTransaction>): RecurringTransaction {
  return {
    id: 'r1',
    externalId: 'r1',
    type: 'expense',
    accountExternalId: 'acc-bank',
    counterAccountExternalId: null,
    categoryExternalId: 'sys-exp-rent',
    amountMinor: 2000000,
    currency: 'INR',
    note: 'Rent',
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 1,
    startDate: '2026-06-01',
    endDate: null,
    lastMaterializedDate: null,
    active: true,
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('materializeDueRecurrences — monthly', () => {
  it('materializes the first occurrence on its start date when never run before', () => {
    const { drafts, updatedLastMaterializedDate } = materializeDueRecurrences([rule({})], '2026-06-01');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].txnDate).toBe('2026-06-01');
    expect(updatedLastMaterializedDate['r1']).toBe('2026-06-01');
  });

  it('materializes every monthly occurrence due since last run, crossing a month boundary', () => {
    const { drafts, updatedLastMaterializedDate } = materializeDueRecurrences(
      [rule({ lastMaterializedDate: '2026-06-01' })],
      '2026-08-01',
    );
    expect(drafts.map((d) => d.txnDate)).toEqual(['2026-07-01', '2026-08-01']);
    expect(updatedLastMaterializedDate['r1']).toBe('2026-08-01');
  });

  it('clamps day-of-month for short months (e.g. day 31 in a 30-day month)', () => {
    const { drafts } = materializeDueRecurrences(
      [rule({ dayOfMonth: 31, startDate: '2026-01-31', lastMaterializedDate: '2026-01-31' })],
      '2026-04-30',
    );
    expect(drafts.map((d) => d.txnDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('produces nothing when the rule is not yet due', () => {
    const { drafts, updatedLastMaterializedDate } = materializeDueRecurrences(
      [rule({ lastMaterializedDate: '2026-06-01' })],
      '2026-06-15',
    );
    expect(drafts).toEqual([]);
    expect(updatedLastMaterializedDate).toEqual({});
  });

  it('skips inactive rules entirely', () => {
    const { drafts } = materializeDueRecurrences([rule({ active: false })], '2026-06-01');
    expect(drafts).toEqual([]);
  });

  it('stops materializing past an end date', () => {
    const { drafts } = materializeDueRecurrences(
      [rule({ lastMaterializedDate: '2026-06-01', endDate: '2026-07-01' })],
      '2026-09-01',
    );
    expect(drafts.map((d) => d.txnDate)).toEqual(['2026-07-01']);
  });
});

describe('materializeDueRecurrences — daily and weekly', () => {
  it('advances by N days for a daily rule with an interval', () => {
    const { drafts } = materializeDueRecurrences(
      [
        rule({
          frequency: 'daily',
          interval: 3,
          dayOfMonth: null,
          startDate: '2026-07-01',
          lastMaterializedDate: '2026-07-01',
        }),
      ],
      '2026-07-10',
    );
    expect(drafts.map((d) => d.txnDate)).toEqual(['2026-07-04', '2026-07-07', '2026-07-10']);
  });

  it('advances by N weeks for a weekly rule', () => {
    const { drafts } = materializeDueRecurrences(
      [
        rule({
          frequency: 'weekly',
          interval: 2,
          dayOfMonth: null,
          startDate: '2026-07-01',
          lastMaterializedDate: '2026-07-01',
        }),
      ],
      '2026-07-29',
    );
    expect(drafts.map((d) => d.txnDate)).toEqual(['2026-07-15', '2026-07-29']);
  });
});

describe('materializedTransactionExternalId', () => {
  it('is deterministic for the same rule and date, so re-materializing after a crash is a no-op upsert', () => {
    const first = materializedTransactionExternalId('r1', '2026-07-01');
    const second = materializedTransactionExternalId('r1', '2026-07-01');
    expect(first).toBe(second);
  });

  it('differs across rules and across dates for the same rule', () => {
    const base = materializedTransactionExternalId('r1', '2026-07-01');
    expect(materializedTransactionExternalId('r2', '2026-07-01')).not.toBe(base);
    expect(materializedTransactionExternalId('r1', '2026-08-01')).not.toBe(base);
  });

  it('produces the same key shape the cashflow forecast dedupe already uses (ruleExternalId|txnDate)', () => {
    const id = materializedTransactionExternalId('r1', '2026-07-01');
    expect(id).toBe('rec-r1-2026-07-01');
  });
});
