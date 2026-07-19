import {
  currentPeriodPrefix,
  formatPeriodLabel,
  lastNDays,
  lastNMonthPrefixes,
  lastNYearPrefixes,
  monthEndDatesForPrefixes,
  periodsFor,
  yearEndDatesForPrefixes,
} from '../periods';

describe('lastNDays', () => {
  it('returns n consecutive days ending with today, oldest first', () => {
    expect(lastNDays('2026-07-05', 5)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ]);
  });

  it('crosses a month/year boundary', () => {
    expect(lastNDays('2026-01-02', 4)).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
  });
});

describe('lastNMonthPrefixes', () => {
  it('crosses a year boundary', () => {
    expect(lastNMonthPrefixes('2026-02-15', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('lastNYearPrefixes', () => {
  it('returns n consecutive years ending with the year containing today', () => {
    expect(lastNYearPrefixes('2026-07-19', 3)).toEqual(['2024', '2025', '2026']);
  });
});

describe('monthEndDatesForPrefixes / yearEndDatesForPrefixes', () => {
  it('resolves the last calendar day of each month, including February', () => {
    expect(monthEndDatesForPrefixes(['2026-02', '2026-04'])).toEqual(['2026-02-28', '2026-04-30']);
  });

  it('resolves December 31 for each year', () => {
    expect(yearEndDatesForPrefixes(['2024', '2026'])).toEqual(['2024-12-31', '2026-12-31']);
  });
});

describe('currentPeriodPrefix', () => {
  it('returns the exact date for day granularity', () => {
    expect(currentPeriodPrefix('2026-07-19', 'day')).toBe('2026-07-19');
  });

  it('returns the month prefix for month granularity', () => {
    expect(currentPeriodPrefix('2026-07-19', 'month')).toBe('2026-07');
  });

  it('returns the year prefix for year granularity', () => {
    expect(currentPeriodPrefix('2026-07-19', 'year')).toBe('2026');
  });
});

describe('periodsFor', () => {
  it('day granularity: prefixes and sample dates are identical', () => {
    const { prefixes, sampleDates } = periodsFor('2026-07-05', 'day', 3);
    expect(prefixes).toEqual(['2026-07-03', '2026-07-04', '2026-07-05']);
    expect(sampleDates).toEqual(prefixes);
  });

  it('year granularity: sample dates are year-end', () => {
    const { prefixes, sampleDates } = periodsFor('2026-07-19', 'year', 2);
    expect(prefixes).toEqual(['2025', '2026']);
    expect(sampleDates).toEqual(['2025-12-31', '2026-12-31']);
  });
});

describe('formatPeriodLabel', () => {
  it('formats a day as MM-DD', () => {
    expect(formatPeriodLabel('2026-07-19', 'day')).toBe('07-19');
  });

  it('formats a month prefix as a 3-letter month abbreviation', () => {
    expect(formatPeriodLabel('2026-07', 'month')).toBe('Jul');
  });

  it('formats a year prefix as the year itself', () => {
    expect(formatPeriodLabel('2026', 'year')).toBe('2026');
  });
});
