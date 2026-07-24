/** Position within the wheel picker's three columns: hour 1-12, minute /5, AM/PM. */
export interface WheelPosition {
  /** 0..11, displayed as "1".."12". */
  hourIndex: number;
  /** 0..11, displayed as "00","05",...,"55". */
  minuteIndex: number;
  isPM: boolean;
}

/**
 * Converts minutes-since-midnight to the nearest wheel position, for
 * pre-scrolling the wheel to a value it can display. Rounds to the nearest
 * 5-minute slot — this is a display-only projection, never a write path: the
 * stored minute only changes when the user scrolls a column and
 * wheelPositionToMinute recomputes it.
 */
export function minuteToWheelPosition(minute: number): WheelPosition {
  const m = ((minute % 1440) + 1440) % 1440;
  const roundedTotal = Math.round(m / 5) * 5;
  const wrapped = roundedTotal % 1440;
  const hour24 = Math.floor(wrapped / 60);
  const minuteOfHour = wrapped % 60;
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    hourIndex: hour12 - 1,
    minuteIndex: minuteOfHour / 5,
    isPM,
  };
}

/** Converts a wheel position back to minutes-since-midnight (always a multiple of 5). */
export function wheelPositionToMinute(pos: WheelPosition): number {
  const hour12 = pos.hourIndex + 1;
  const hour24 = pos.isPM ? (hour12 % 12) + 12 : hour12 % 12;
  return hour24 * 60 + pos.minuteIndex * 5;
}
