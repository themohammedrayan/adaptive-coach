import { DEFAULT_CONFIG } from '../constants';
import { computeTarget, projectFinish, requiredBalance } from '../target';

describe('requiredBalance (BRD §5.4 — the signed seam)', () => {
  it('is negative (deficit) when above goal, positive (surplus) when below', () => {
    expect(requiredBalance(100, 90, 154, 7700)).toBeCloseTo(-500, 6);
    expect(requiredBalance(60, 65, 154, 7700)).toBeGreaterThan(0);
  });

  it('recomputes against remaining time — falling behind deepens the required deficit', () => {
    const early = requiredBalance(100, 90, 150, 7700);
    const late = requiredBalance(100, 90, 75, 7700);
    expect(late).toBeCloseTo(early * 2, 6);
  });
});

describe('computeTarget clamps (BRD §5.5 — fixed order)', () => {
  it('caps the loss rate at ~1% bodyweight/week', () => {
    // maxDeficit = 0.01 · 100 · 7700 / 7 = 1100/day
    const t = computeTarget(2275, -2500, 100, null, 1000, DEFAULT_CONFIG);
    expect(t.targetKcal).toBe(2275 - 1100);
    expect(t.boundHit).toBe('lossRateCap');
  });

  it('limits moves to ±125 kcal vs the previous target', () => {
    const t = computeTarget(2275, -524, 100, 2000, 1500, DEFAULT_CONFIG);
    expect(t.rawTargetKcal).toBeCloseTo(1751, 0);
    expect(t.targetKcal).toBe(1875); // 2000 − 125
    expect(t.boundHit).toBe('moveLimit');
  });

  it('applies the calorie floor last — it wins even over the move limit', () => {
    // raw 1200 is inside prev 1300's move window, but below the 1500 floor
    const t = computeTarget(1700, -500, 100, 1300, 1500, DEFAULT_CONFIG);
    expect(t.targetKcal).toBe(1500);
    expect(t.boundHit).toBe('calorieFloor');
  });

  it('hits no bound when the goal pace is comfortable', () => {
    const t = computeTarget(2500, -300, 100, null, 1500, DEFAULT_CONFIG);
    expect(t.targetKcal).toBe(2200);
    expect(t.boundHit).toBe('none');
    expect(t.effectiveDeficit).toBe(300);
  });
});

describe('projectFinish (BRD §5.6)', () => {
  it('projects from the effective deficit', () => {
    // 10 kg · 7700 / 500 = 154 days
    expect(projectFinish(100, 90, 500, '2026-07-15', 7700)).toBe(
      '2026-12-16',
    );
  });

  it('returns null when stalled or gaining', () => {
    expect(projectFinish(100, 90, 0, '2026-07-15', 7700)).toBeNull();
    expect(projectFinish(100, 90, -100, '2026-07-15', 7700)).toBeNull();
  });

  it('returns today when the goal is already reached', () => {
    expect(projectFinish(89.5, 90, 500, '2026-07-15', 7700)).toBe('2026-07-15');
  });
});
