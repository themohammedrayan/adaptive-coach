import type { DailyTotals } from '../../food-log';
import { buildAdherenceSummary } from '../adherence';

function day(localDate: string, logged: boolean, kcal = 0): DailyTotals {
  return {
    localDate,
    kcal,
    protein: 0,
    carb: 0,
    fat: 0,
    fiber: 0,
    entryCount: logged ? 1 : 0,
    logged,
    markedComplete: false,
    macrosIncomplete: false,
  };
}

describe('buildAdherenceSummary — Dashboard BRD §C AT3', () => {
  it('counts logged days correctly over 14 days and averages logged-only intake', () => {
    const last14: DailyTotals[] = [
      day('2026-07-01', true, 1800),
      day('2026-07-02', false),
      day('2026-07-03', true, 2000),
      ...Array.from({ length: 11 }, (_, i) => day(`2026-07-${String(4 + i).padStart(2, '0')}`, false)),
    ];
    const summary = buildAdherenceSummary(last14, 1900);
    expect(summary.days).toHaveLength(14);
    expect(summary.days.filter((d) => d.logged)).toHaveLength(2);
    expect(summary.avgIntake).toBeCloseTo((1800 + 2000) / 2);
    expect(summary.avgTarget).toBe(1900);
  });

  it('avgIntake is 0 when nothing is logged; avgTarget 0 when target is null', () => {
    const last14 = Array.from({ length: 14 }, (_, i) =>
      day(`2026-07-${String(1 + i).padStart(2, '0')}`, false),
    );
    const summary = buildAdherenceSummary(last14, null);
    expect(summary.avgIntake).toBe(0);
    expect(summary.avgTarget).toBe(0);
  });
});
