import { minuteToWheelPosition, wheelPositionToMinute } from '../wheelTime';

describe('wheelPositionToMinute / minuteToWheelPosition', () => {
  it('round-trips exact 5-minute values', () => {
    // 9:30am = 570
    const pos = minuteToWheelPosition(570);
    expect(pos).toEqual({ hourIndex: 8, minuteIndex: 6, isPM: false });
    expect(wheelPositionToMinute(pos)).toBe(570);
  });

  it('rounds a legacy non-5-minute value to the nearest slot, including the carry-into-next-hour edge case', () => {
    // 9:58am = 598 -> rounds to 10:00am = 600
    const pos = minuteToWheelPosition(598);
    expect(pos).toEqual({ hourIndex: 9, minuteIndex: 0, isPM: false });
    expect(wheelPositionToMinute(pos)).toBe(600);
  });

  it('handles the midnight boundary', () => {
    const pos = minuteToWheelPosition(0);
    expect(pos).toEqual({ hourIndex: 11, minuteIndex: 0, isPM: false });
    expect(wheelPositionToMinute(pos)).toBe(0);
  });

  it('handles 11:55pm', () => {
    const pos = minuteToWheelPosition(1435);
    expect(pos).toEqual({ hourIndex: 10, minuteIndex: 11, isPM: true });
    expect(wheelPositionToMinute(pos)).toBe(1435);
  });

  it('maps noon (hour 12) and midnight (hour 0) to displayed "12" on the correct side of AM/PM', () => {
    // Noon = 720
    const noon = minuteToWheelPosition(720);
    expect(noon).toEqual({ hourIndex: 11, minuteIndex: 0, isPM: true });
    expect(wheelPositionToMinute(noon)).toBe(720);

    // Midnight = 0, already covered above, but re-assert isPM is false here for clarity.
    expect(minuteToWheelPosition(0).isPM).toBe(false);
  });
});
