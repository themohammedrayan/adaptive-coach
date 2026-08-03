import { addMoney, formatMoneyCompact, formatMoneyMinor, parseMoneyInput, subtractMoney, sumMoney } from '../money';

describe('formatMoneyMinor', () => {
  it('groups INR with Indian lakh/crore commas', () => {
    expect(formatMoneyMinor(1234567800, 'INR')).toBe('₹1,23,45,678.00');
  });

  it('formats a small INR amount with no grouping needed', () => {
    expect(formatMoneyMinor(50000, 'INR')).toBe('₹500.00');
  });

  it('formats a negative amount with a leading minus before the symbol', () => {
    expect(formatMoneyMinor(-150050, 'INR')).toBe('-₹1,500.50');
  });

  it('optionally shows a leading plus for positive amounts', () => {
    expect(formatMoneyMinor(150050, 'INR', { showSign: true })).toBe('+₹1,500.50');
  });

  it('groups non-INR currencies with Western thousands commas', () => {
    expect(formatMoneyMinor(123456780, 'USD')).toBe('$1,234,567.80');
  });

  it('falls back to the currency code for an unknown symbol', () => {
    expect(formatMoneyMinor(10000, 'XYZ')).toBe('XYZ 100.00');
  });
});

describe('parseMoneyInput', () => {
  it('parses a plain integer as major units', () => expect(parseMoneyInput('500')).toBe(50000));
  it('parses a decimal amount', () => expect(parseMoneyInput('1500.5')).toBe(150050));
  it('strips thousands separators before parsing', () => expect(parseMoneyInput('1,23,456.78')).toBe(12345678));
  it('parses a negative amount', () => expect(parseMoneyInput('-99.99')).toBe(-9999));
  it('rejects empty input', () => expect(parseMoneyInput('  ')).toBeNull());
  it('rejects more than 2 decimal places', () => expect(parseMoneyInput('1.234')).toBeNull());
  it('rejects non-numeric input', () => expect(parseMoneyInput('abc')).toBeNull());
});

describe('money arithmetic', () => {
  it('adds and subtracts minor units directly', () => {
    expect(addMoney(100, 50)).toBe(150);
    expect(subtractMoney(100, 50)).toBe(50);
  });

  it('sums a list of minor-unit amounts', () => {
    expect(sumMoney([100, -30, 20])).toBe(90);
    expect(sumMoney([])).toBe(0);
  });
});

describe('formatMoneyCompact', () => {
  it('leaves sub-thousand amounts whole', () => {
    expect(formatMoneyCompact(45000, 'INR')).toBe('₹450');
    expect(formatMoneyCompact(0, 'INR')).toBe('₹0');
  });

  it('compacts thousands and drops a trailing tenth', () => {
    expect(formatMoneyCompact(200000, 'INR')).toBe('₹2k'); // ₹2,000 exactly
    expect(formatMoneyCompact(1240000, 'INR')).toBe('₹12.4k'); // ₹12,400
  });

  it('compacts INR to lakh and crore', () => {
    expect(formatMoneyCompact(12400000, 'INR')).toBe('₹1.2L'); // ₹1,24,000
    expect(formatMoneyCompact(150000000, 'INR')).toBe('₹15L'); // ₹15,00,000
    expect(formatMoneyCompact(1000000000, 'INR')).toBe('₹1Cr'); // ₹1,00,00,000
  });

  it('compacts other currencies to k/M/B instead of lakh', () => {
    expect(formatMoneyCompact(12400000, 'USD')).toBe('$124k');
    expect(formatMoneyCompact(500000000, 'USD')).toBe('$5M');
  });

  it('puts the sign before the symbol', () => {
    expect(formatMoneyCompact(-1240000, 'INR')).toBe('-₹12.4k');
  });

  it('falls back to a currency-code prefix for unknown currencies', () => {
    expect(formatMoneyCompact(200000, 'JPY')).toBe('JPY 2k');
  });
});
