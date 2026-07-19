import type { IsoDate } from '../engine';
import type { AccountValuation } from './types';

/** Latest valuation for an account as of a date, or null if none has been entered yet. */
export function latestValuationAsOf(
  valuations: AccountValuation[],
  accountExternalId: string,
  asOfDate: IsoDate,
): number | null {
  let best: AccountValuation | null = null;
  for (const v of valuations) {
    if (v.accountExternalId !== accountExternalId || v.asOfDate > asOfDate) continue;
    if (best === null || v.asOfDate > best.asOfDate) best = v;
  }
  return best === null ? null : best.amountMinor;
}
