import { advanceOccurrence, occurrenceDatesBetween } from '../recurrenceDates';
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

describe('advanceOccurrence', () => {
  it('advances a monthly rule by its interval, clamping into a short month', () => {
    // Jan 31 + 1 month clamps to Feb 28 (2026 is not a leap year).
    expect(advanceOccurrence(rule({ dayOfMonth: 31 }), '2026-01-31')).toBe('2026-02-28');
  });

  it('re-expands after a clamp rather than sticking to the clamped day', () => {
    // Feb 28 + 1 month with dayOfMonth 31 goes to Mar 31, not Mar 28 — the
    // clamp is per-step, it never rewrites the rule's day-of-month.
    expect(advanceOccurrence(rule({ dayOfMonth: 31 }), '2026-02-28')).toBe('2026-03-31');
  });

  it('falls back to the start date day-of-month when dayOfMonth is null', () => {
    expect(advanceOccurrence(rule({ dayOfMonth: null, startDate: '2026-06-17' }), '2026-06-17')).toBe('2026-07-17');
  });

  it('advances daily and weekly rules by interval days/weeks', () => {
    expect(advanceOccurrence(rule({ frequency: 'daily', interval: 3, dayOfMonth: null }), '2026-07-01')).toBe(
      '2026-07-04',
    );
    expect(advanceOccurrence(rule({ frequency: 'weekly', interval: 2, dayOfMonth: null }), '2026-07-01')).toBe(
      '2026-07-15',
    );
  });
});

describe('occurrenceDatesBetween — forward projection', () => {
  it('walks past today into the future, which materialization never does', () => {
    const dates = occurrenceDatesBetween(rule({ lastMaterializedDate: '2026-08-01' }), '2026-08-01', '2026-11-01');
    expect(dates).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  });

  it('starts at the rule start date when fromExclusive is null', () => {
    const dates = occurrenceDatesBetween(rule({ startDate: '2026-06-01' }), null, '2026-08-01');
    expect(dates).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('excludes fromExclusive itself', () => {
    const dates = occurrenceDatesBetween(rule({}), '2026-06-01', '2026-07-01');
    expect(dates).toEqual(['2026-07-01']);
  });

  it('includes throughInclusive when an occurrence lands exactly on it', () => {
    const dates = occurrenceDatesBetween(rule({}), '2026-06-01', '2026-08-01');
    expect(dates[dates.length - 1]).toBe('2026-08-01');
  });

  it('clamps day-of-month across a run of short months', () => {
    const dates = occurrenceDatesBetween(
      rule({ dayOfMonth: 31, startDate: '2026-01-31' }),
      '2026-01-31',
      '2026-05-31',
    );
    expect(dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('truncates at the rule end date even when the horizon runs further', () => {
    const dates = occurrenceDatesBetween(rule({ endDate: '2026-09-01' }), '2026-06-01', '2026-12-01');
    expect(dates).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });

  it('returns nothing when the rule has not started by the horizon', () => {
    expect(occurrenceDatesBetween(rule({ startDate: '2027-01-01' }), null, '2026-12-01')).toEqual([]);
  });

  it('returns nothing when the horizon is already behind fromExclusive', () => {
    expect(occurrenceDatesBetween(rule({}), '2026-08-01', '2026-07-01')).toEqual([]);
  });

  it('honours interval > 1 on a monthly rule', () => {
    const dates = occurrenceDatesBetween(rule({ interval: 3 }), '2026-06-01', '2026-12-31');
    expect(dates).toEqual(['2026-09-01', '2026-12-01']);
  });

  it('generates a dense daily series across a month boundary', () => {
    const dates = occurrenceDatesBetween(
      rule({ frequency: 'daily', interval: 1, dayOfMonth: null, startDate: '2026-07-30' }),
      null,
      '2026-08-02',
    );
    expect(dates).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']);
  });

  it('caps a pathological horizon rather than looping forever', () => {
    // A daily rule over ~55 years would be ~20k occurrences; the guard stops at 10k.
    const dates = occurrenceDatesBetween(
      rule({ frequency: 'daily', interval: 1, dayOfMonth: null, startDate: '2026-01-01' }),
      null,
      '2081-01-01',
    );
    expect(dates).toHaveLength(10_000);
  });
});
