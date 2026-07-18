import { deriveMode, horizonDaysFromWeeklyRate, weeklyRateFromHorizonDays } from '../pace';

describe('deriveMode', () => {
  it('lose when goal is below start', () => expect(deriveMode(100, 80)).toBe('lose'));
  it('gain when goal is above start', () => expect(deriveMode(70, 80)).toBe('gain'));
  it('maintain when goal equals start', () => expect(deriveMode(80, 80)).toBe('maintain'));
});

describe('horizonDaysFromWeeklyRate / weeklyRateFromHorizonDays — inverse of each other', () => {
  it('20kg to lose at 0.5kg/week takes 280 days', () => {
    expect(horizonDaysFromWeeklyRate(100, 80, 0.5)).toBe(280);
  });

  it('weeklyRateFromHorizonDays recovers ~the same rate given that horizon', () => {
    const horizonDays = horizonDaysFromWeeklyRate(100, 80, 0.5);
    expect(weeklyRateFromHorizonDays(100, 80, horizonDays)).toBeCloseTo(0.5, 1);
  });

  it('180 days to lose 20kg implies ~0.78kg/week', () => {
    expect(weeklyRateFromHorizonDays(100, 80, 180)).toBeCloseTo(20 / 180 * 7, 5);
  });

  it('handles a gain goal the same way (uses the absolute delta)', () => {
    expect(horizonDaysFromWeeklyRate(70, 80, 0.5)).toBe(140);
  });

  it('never returns fewer than 1 day even for a zero-length goal or rate', () => {
    expect(horizonDaysFromWeeklyRate(80, 80, 0.5)).toBe(1);
    expect(horizonDaysFromWeeklyRate(100, 80, 0)).toBe(1);
  });
});
