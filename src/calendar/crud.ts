import type { IsoDate } from '../engine';
import type { DayOverride, ResolvedBlock, RoutineBlock, RoutineCategory } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface BuildRoutineBlockInput {
  label: string;
  startMinute: number;
  endMinute: number;
  category: RoutineCategory;
  daysOfWeek: number[];
}

export function buildRoutineBlock(
  input: BuildRoutineBlockInput,
  nowIso: string,
  genId: IdGenerator = defaultGenId,
): RoutineBlock {
  const id = genId();
  return {
    id,
    externalId: id,
    label: input.label,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    category: input.category,
    daysOfWeek: input.daysOfWeek,
    updatedAt: nowIso,
  };
}

export function buildOverrideForDate(
  date: IsoDate,
  blocks: ResolvedBlock[],
  nowIso: string,
  genId: IdGenerator = defaultGenId,
): DayOverride {
  const id = genId();
  return { id, externalId: id, date, blocks, updatedAt: nowIso };
}

/**
 * Splices an edited block into an already-resolved day, for the "just
 * today" edit scope — the caller persists the returned array as that
 * date's override via buildOverrideForDate.
 */
export function applyDateOverrideEdit(
  resolvedDay: ResolvedBlock[],
  index: number,
  edited: ResolvedBlock,
): ResolvedBlock[] {
  const next = [...resolvedDay];
  next[index] = edited;
  return next;
}
