import { addDays, type IsoDate } from '../engine';
import type { DayOverride, ResolvedBlock, RoutineBlock } from './types';

/** 0=Sun..6=Sat. Calendar-day arithmetic only — never touches device timezone. */
export function dayOfWeek(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Sunday (0) that begins the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -dayOfWeek(date));
}

function byStartMinute(a: ResolvedBlock, b: ResolvedBlock): number {
  return a.startMinute - b.startMinute;
}

/**
 * An override for `date` replaces the resolved day wholesale; otherwise the
 * template blocks that apply to that date's weekday are used, sorted by
 * start time.
 */
export function resolveDay(
  templateBlocks: RoutineBlock[],
  overrides: DayOverride[],
  date: IsoDate,
): ResolvedBlock[] {
  const override = overrides.find((o) => o.date === date);
  if (override !== undefined) return [...override.blocks].sort(byStartMinute);

  const weekday = dayOfWeek(date);
  return templateBlocks.filter((b) => b.daysOfWeek.includes(weekday)).sort(byStartMinute);
}
