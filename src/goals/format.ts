import { diffDays, type IsoDate } from '../engine';

/**
 * Coarse time-to-goal for the ring strip: days up close, then months, then
 * years. Goals span from "next week" to "retire in 30 years", so a single unit
 * would be unreadable at one end or the other.
 */
export function timeToGoalLabel(targetDate: IsoDate | null, today: IsoDate): string {
  if (targetDate === null) return '—';
  const days = diffDays(targetDate, today);
  if (days < 0) return 'past';
  if (days < 60) return `${days}d`;
  if (days < 730) return `${Math.round(days / 30)}m`;
  return `${Math.round(days / 365)}y`;
}
