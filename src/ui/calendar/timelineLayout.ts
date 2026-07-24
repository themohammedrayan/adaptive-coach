import type { ResolvedBlock } from '../../calendar/types';

export const HOUR_HEIGHT = 44;
export const DAY_HEIGHT = HOUR_HEIGHT * 24;
export const GUTTER = 52;
export const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

export function formatHour(hour: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
}

/** Pixel top/height for a block on a vertical timeline scaled at `hourHeight` px/hour. */
export function blockRect(
  block: ResolvedBlock,
  hourHeight: number = HOUR_HEIGHT,
): { top: number; height: number; overflowsToTomorrow: boolean } {
  const top = (block.startMinute / 60) * hourHeight;
  const visibleEnd = Math.min(block.endMinute, 1440);
  const height = Math.max(((visibleEnd - block.startMinute) / 60) * hourHeight, 20);
  const overflowsToTomorrow = block.endMinute > 1440;
  return { top, height, overflowsToTomorrow };
}
