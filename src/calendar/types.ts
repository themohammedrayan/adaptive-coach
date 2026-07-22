import type { IsoDate } from '../engine';

export type RoutineCategory = 'sleep' | 'work' | 'travel' | 'exercise' | 'meals' | 'other';

export const ROUTINE_CATEGORIES: RoutineCategory[] = [
  'sleep',
  'work',
  'travel',
  'exercise',
  'meals',
  'other',
];

/** A single resolved time block for one calendar day. */
export interface ResolvedBlock {
  label: string;
  /** Minutes since local midnight, 0..1439. */
  startMinute: number;
  /** Minutes since local midnight; may exceed 1440 for a block that runs
   * past midnight (e.g. sleep 11pm-7am = startMinute 1380, endMinute 1860).
   * The block still belongs to the day it starts on. */
  endMinute: number;
  category: RoutineCategory;
}

/** One row of the reusable weekly template. */
export interface RoutineBlock extends ResolvedBlock {
  id: string;
  externalId: string;
  /** 0=Sun..6=Sat — which days of the week this block applies to. */
  daysOfWeek: number[];
  updatedAt: string;
}

/** A whole-day replacement for the template's resolved schedule on one date. */
export interface DayOverride {
  id: string;
  externalId: string;
  date: IsoDate;
  blocks: ResolvedBlock[];
  updatedAt: string;
}
