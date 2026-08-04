import { timeToGoalLabel } from '../format';

describe('timeToGoalLabel', () => {
  const today = '2026-08-15';

  it('shows a dash when there is no target date', () => {
    expect(timeToGoalLabel(null, today)).toBe('—');
  });

  it('counts in days up close', () => {
    expect(timeToGoalLabel('2026-08-27', today)).toBe('12d');
    expect(timeToGoalLabel('2026-08-15', today)).toBe('0d');
  });

  it('switches to months from two months out', () => {
    expect(timeToGoalLabel('2026-10-14', today)).toBe('2m'); // 60 days
    expect(timeToGoalLabel('2027-02-15', today)).toBe('6m');
  });

  it('switches to years past two years out', () => {
    expect(timeToGoalLabel('2056-08-15', today)).toBe('30y');
  });

  it('reads past for a target date already gone', () => {
    expect(timeToGoalLabel('2026-08-14', today)).toBe('past');
  });
});
