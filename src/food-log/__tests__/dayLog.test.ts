import { toDayLog } from '../dayLog';
import type { DailyTotals } from '../types';

describe('toDayLog — Food-Log BRD §8', () => {
  it('maps DailyTotals fields onto the Engine DayLog shape', () => {
    const totals: DailyTotals = {
      localDate: '2026-07-15',
      kcal: 1800,
      protein: 120,
      carb: 180,
      fat: 60,
      fiber: 25,
      entryCount: 4,
      logged: true,
      markedComplete: false,
      macrosIncomplete: false,
    };
    expect(toDayLog(totals)).toEqual({
      date: '2026-07-15',
      kcal: 1800,
      protein: 120,
      carb: 180,
      fat: 60,
      fiber: 25,
      logged: true,
    });
  });

  it('an empty day maps to logged=false', () => {
    const totals: DailyTotals = {
      localDate: '2026-07-16',
      kcal: 0,
      protein: 0,
      carb: 0,
      fat: 0,
      fiber: 0,
      entryCount: 0,
      logged: false,
      markedComplete: false,
      macrosIncomplete: false,
    };
    expect(toDayLog(totals).logged).toBe(false);
  });
});
