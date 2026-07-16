import { isEmptyConsumption, toMacros } from '../adapters';

describe('toMacros — Dashboard BRD §C AT2', () => {
  it('maps DailyTotals macro fields onto the Engine Macros shape', () => {
    expect(toMacros({ protein: 120, carb: 180, fat: 60, fiber: 25 })).toEqual({
      proteinG: 120,
      carbG: 180,
      fatG: 60,
      fiberG: 25,
    });
  });
});

describe('isEmptyConsumption', () => {
  it('true only when every macro is exactly zero', () => {
    expect(isEmptyConsumption({ proteinG: 0, carbG: 0, fatG: 0, fiberG: 0 })).toBe(true);
    expect(isEmptyConsumption({ proteinG: 1, carbG: 0, fatG: 0, fiberG: 0 })).toBe(false);
  });
});
