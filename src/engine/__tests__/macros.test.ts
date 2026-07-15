import { DEFAULT_CONFIG } from '../constants';
import { splitMacros } from '../macros';

describe('splitMacros (BRD §5.7)', () => {
  it('splits a comfortable target: protein 1.8 g/kg, fat floors, carbs remainder', () => {
    const { macros, warning } = splitMacros(2000, 80, DEFAULT_CONFIG);
    expect(macros.proteinG).toBe(144); // 1.8 · 80
    expect(macros.fatG).toBe(48); // g/kg floor (0.6·80) beats 20% of kcal (44.4)
    expect(macros.carbG).toBe(248); // (2000 − 576 − 432) / 4
    expect(macros.fiberG).toBe(28); // 14 g / 1000 kcal
    expect(warning).toBeNull();
    // kcal identity holds (fiber excluded)
    expect(4 * macros.proteinG + 4 * macros.carbG + 9 * macros.fatG).toBe(2000);
  });

  it('uses the 20% fat rule when it exceeds the g/kg floor', () => {
    const { macros } = splitMacros(3000, 70, DEFAULT_CONFIG);
    expect(macros.fatG).toBe(Math.round((0.2 * 3000) / 9)); // 67 > 0.6·70 = 42
  });

  it('reconciles a low target: fat drops toward its floor before carbs pin', () => {
    // The lower-fat-first branch needs fat set by the % rule above its g/kg
    // floor; with default 20% that never coincides with carbs < 50 g at real
    // body weights, so exercise it with a higher fat percentage.
    const cfg = { ...DEFAULT_CONFIG, fatMinPct: 0.45 };
    // 100 kg, 1600 kcal: protein 180 (720), fat 45% = 80 g (720) → carb 40 < 50
    // → fat lowers to (1600 − 720 − 200)/9 = 75.6 (above floor 60) → carb pins at 50
    const { macros, warning } = splitMacros(1600, 100, cfg);
    expect(macros.proteinG).toBe(180); // protein never sacrificed
    expect(macros.fatG).toBe(76);
    expect(macros.carbG).toBe(50);
    expect(warning).toBeNull();
  });

  it('warns when the target is below a viable split (BRD acceptance test 7)', () => {
    // 120 kg, 1500 kcal: protein 216 (864) + fat floor 72 (648) already exceed 1500
    const { macros, warning } = splitMacros(1500, 120, DEFAULT_CONFIG);
    expect(macros.proteinG).toBe(216); // kept — muscle priority
    expect(macros.fatG).toBe(72); // pinned at its g/kg floor
    expect(macros.carbG).toBe(50); // pinned at CARB_MIN_G
    expect(warning).not.toBeNull();
  });
});
