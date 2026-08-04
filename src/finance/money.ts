/**
 * Money as integer minor units (e.g. paise for INR) — never floats. Hand-rolled
 * because no currency/number-formatting library exists in this repo, and
 * `Intl.NumberFormat` currency formatting has patchy Hermes support.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return [...groups, last3].join(',');
}

function groupWestern(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface FormatMoneyOptions {
  /** Force a leading '+' for positive values (e.g. income rows in a list). */
  showSign?: boolean;
}

/** Pure, injectable formatter — no device locale read. */
export function formatMoneyMinor(
  amountMinor: number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.round(amountMinor));
  const major = Math.floor(abs / 100);
  const fraction = abs % 100;
  const grouped = currency === 'INR' ? groupIndian(String(major)) : groupWestern(String(major));
  const sign = negative ? '-' : options.showSign ? '+' : '';
  return `${sign}${symbol}${grouped}.${String(fraction).padStart(2, '0')}`;
}

/** Drops a trailing '.0' so 2000 reads '2k', not '2.0k'. */
function trimTenth(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

/**
 * Space-constrained money for calendar cells, where `formatMoneyMinor` would
 * render '₹1,24,000.00' into a one-seventh-width column. Rounds hard and drops
 * the fraction — never use it where an exact figure matters.
 *
 * INR compacts to lakh/crore, consistent with this file's Indian digit
 * grouping; every other currency compacts to k/M/B.
 */
export function formatMoneyCompact(amountMinor: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const sign = amountMinor < 0 ? '-' : '';
  const major = Math.floor(Math.abs(Math.round(amountMinor)) / 100);

  const scaled =
    currency === 'INR'
      ? major >= 10_000_000
        ? `${trimTenth(major / 10_000_000)}Cr`
        : major >= 100_000
          ? `${trimTenth(major / 100_000)}L`
          : major >= 1_000
            ? `${trimTenth(major / 1_000)}k`
            : String(major)
      : major >= 1_000_000_000
        ? `${trimTenth(major / 1_000_000_000)}B`
        : major >= 1_000_000
          ? `${trimTenth(major / 1_000_000)}M`
          : major >= 1_000
            ? `${trimTenth(major / 1_000)}k`
            : String(major);

  return `${sign}${symbol}${scaled}`;
}

/** Parses a user-typed amount (major units, e.g. "1,234.50") into minor units. Returns null if invalid. */
export function parseMoneyInput(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (trimmed === '' || !/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function addMoney(a: number, b: number): number {
  return a + b;
}

export function subtractMoney(a: number, b: number): number {
  return a - b;
}

export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
