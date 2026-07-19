import { projectNetWorth } from '../projection';
import type { NetWorthPoint } from '../netWorth';

function series(values: number[]): NetWorthPoint[] {
  return values.map((netWorthMinor, i) => ({ date: `2026-0${i + 1}-28`, netWorthMinor }));
}

describe('projectNetWorth', () => {
  it('extrapolates from the average month-over-month delta', () => {
    const points = projectNetWorth(series([100_000, 110_000, 120_000]), [1, 2]);
    expect(points).toEqual([
      { monthsAhead: 1, projectedNetWorthMinor: 130_000 },
      { monthsAhead: 2, projectedNetWorthMinor: 140_000 },
    ]);
  });

  it('holds flat when there is fewer than two historical points', () => {
    expect(projectNetWorth(series([50_000]), [3])).toEqual([{ monthsAhead: 3, projectedNetWorthMinor: 50_000 }]);
    expect(projectNetWorth([], [3])).toEqual([{ monthsAhead: 3, projectedNetWorthMinor: 0 }]);
  });

  it('projects a decline when net worth is trending down', () => {
    const points = projectNetWorth(series([100_000, 80_000, 60_000]), [1]);
    expect(points).toEqual([{ monthsAhead: 1, projectedNetWorthMinor: 40_000 }]);
  });
});
