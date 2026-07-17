import { computeYAxisScale } from '../chartScale';

describe('computeYAxisScale', () => {
  it('pads a normal spread around its data range, not anchored at 0', () => {
    const { min, max } = computeYAxisScale([80, 90, 100]);
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(80);
    expect(max).toBeGreaterThan(100);
  });

  it('applies the minSpan guard when data is near-flat', () => {
    const { min, max } = computeYAxisScale([34.0, 34.2, 34.1], [], { minSpan: 2 });
    expect(max - min).toBeGreaterThanOrEqual(2);
  });

  it('applies the minSpan guard for a single data point', () => {
    const { min, max } = computeYAxisScale([99], [], { minSpan: 2 });
    expect(max - min).toBeGreaterThanOrEqual(2);
    expect(min).toBeLessThan(99);
    expect(max).toBeGreaterThan(99);
  });

  it('extends the range to cover an include value outside the data range', () => {
    const { min, max } = computeYAxisScale([100, 102], [80]);
    expect(min).toBeLessThanOrEqual(80);
    expect(max).toBeGreaterThanOrEqual(102);
  });

  it('handles an empty values array with only an include value (e.g. no weigh-ins yet, goal set)', () => {
    const { min, max } = computeYAxisScale([], [75], { minSpan: 2 });
    expect(max - min).toBeGreaterThanOrEqual(2);
    expect(min).toBeLessThanOrEqual(75);
    expect(max).toBeGreaterThanOrEqual(75);
  });

  it('does not throw on entirely empty input', () => {
    expect(() => computeYAxisScale([])).not.toThrow();
  });
});
