import { DEFAULT_CONFIG } from '../constants';
import { coldStartBlend, estimateTDEE, rmrMifflinStJeor } from '../tdee';
import type { DayLog, Profile } from '../types';

const log = (date: string, kcal: number, logged = true): DayLog => ({
  date,
  kcal,
  protein: 0,
  carb: 0,
  fat: 0,
  fiber: 0,
  logged,
});

const profile: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  activityFactor: 1.5,
  goalWeightKg: 80,
  horizonDays: 180,
  startDate: '2026-07-01',
  mode: 'lose',
};

describe('estimateTDEE (BRD §5.2, worked example §8.1)', () => {
  it('matches the BRD arithmetic: 2000 kcal intake, −0.5 kg over 14d → 2275', () => {
    const tdee = estimateTDEE(
      {
        logs: [log('2026-07-01', 2000), log('2026-07-02', 2000)],
        trendStartKg: 100,
        trendEndKg: 99.5,
        windowDays: 14,
      },
      DEFAULT_CONFIG,
    );
    expect(tdee).toBeCloseTo(2000 + (0.5 * 7700) / 14, 6); // = 2275
  });

  it('averages logged days only — never imputes zeros', () => {
    const tdee = estimateTDEE(
      {
        logs: [log('2026-07-01', 2000), log('2026-07-02', 1000, false)],
        trendStartKg: 100,
        trendEndKg: 100,
        windowDays: 14,
      },
      DEFAULT_CONFIG,
    );
    expect(tdee).toBe(2000); // unlogged 1000 kcal day ignored
  });

  it('returns null with no logged days or no trend', () => {
    expect(
      estimateTDEE(
        { logs: [], trendStartKg: 100, trendEndKg: 99, windowDays: 14 },
        DEFAULT_CONFIG,
      ),
    ).toBeNull();
    expect(
      estimateTDEE(
        { logs: [log('2026-07-01', 2000)], trendStartKg: null, trendEndKg: 99, windowDays: 14 },
        DEFAULT_CONFIG,
      ),
    ).toBeNull();
  });
});

describe('coldStartBlend (BRD §5.3)', () => {
  const rmr = rmrMifflinStJeor(profile, 100); // 10·100 + 6.25·175 − 5·30 + 5 = 1948.75
  const seed = rmr * profile.activityFactor;

  it('computes Mifflin–St Jeor correctly', () => {
    expect(rmr).toBeCloseTo(1948.75, 6);
    expect(rmrMifflinStJeor({ ...profile, sex: 'female' }, 100)).toBeCloseTo(1782.75, 6);
  });

  it('is pure seed with no data estimate', () => {
    const { tdeeUsed, seedShare } = coldStartBlend(null, profile, 100, 0, DEFAULT_CONFIG);
    expect(tdeeUsed).toBeCloseTo(seed, 6);
    expect(seedShare).toBe(1);
  });

  it('ramps toward data as days accumulate', () => {
    const day3 = coldStartBlend(1800, profile, 100, 3, DEFAULT_CONFIG);
    expect(day3.seedShare).toBeCloseTo(1 - 3 / 14, 6);
    expect(day3.tdeeUsed).toBeCloseTo((3 / 14) * 1800 + (11 / 14) * seed, 6);

    const full = coldStartBlend(1800, profile, 100, 14, DEFAULT_CONFIG);
    expect(full.tdeeUsed).toBe(1800);
    expect(full.seedShare).toBe(0);
  });
});
