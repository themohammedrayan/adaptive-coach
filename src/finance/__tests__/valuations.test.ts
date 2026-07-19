import type { AccountValuation } from '../types';
import { latestValuationAsOf } from '../valuations';

function valuation(overrides: Partial<AccountValuation>): AccountValuation {
  return {
    id: 'v1',
    externalId: 'v1',
    accountExternalId: 'acc-invest',
    amountMinor: 100000,
    asOfDate: '2026-07-01',
    source: 'manual',
    note: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('latestValuationAsOf', () => {
  it('picks the most recent valuation at or before the date', () => {
    const valuations = [
      valuation({ id: '1', externalId: '1', asOfDate: '2026-06-01', amountMinor: 90000 }),
      valuation({ id: '2', externalId: '2', asOfDate: '2026-07-01', amountMinor: 100000 }),
      valuation({ id: '3', externalId: '3', asOfDate: '2026-08-01', amountMinor: 110000 }), // after asOfDate
    ];
    expect(latestValuationAsOf(valuations, 'acc-invest', '2026-07-15')).toBe(100000);
  });

  it('returns null when no valuation exists yet as of that date', () => {
    const valuations = [valuation({ asOfDate: '2026-08-01' })];
    expect(latestValuationAsOf(valuations, 'acc-invest', '2026-07-01')).toBeNull();
  });

  it('ignores valuations for other accounts', () => {
    const valuations = [valuation({ accountExternalId: 'acc-other' })];
    expect(latestValuationAsOf(valuations, 'acc-invest', '2026-07-15')).toBeNull();
  });
});
