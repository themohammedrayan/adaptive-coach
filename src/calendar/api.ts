import { supabase } from '../lib/supabase';
import type { DayOverride, ResolvedBlock, RoutineBlock, RoutineCategory } from './types';

/* --------------------------------------------------------- template blocks */

interface ServerRoutineBlockRow {
  external_id: string;
  label: string;
  start_minute: number;
  end_minute: number;
  category: RoutineCategory;
  days_of_week: number[];
  updated_at?: string;
}

function routineBlockToServer(b: RoutineBlock) {
  return {
    external_id: b.externalId,
    label: b.label,
    start_minute: b.startMinute,
    end_minute: b.endMinute,
    category: b.category,
    days_of_week: b.daysOfWeek,
  };
}

function routineBlockFromServer(r: ServerRoutineBlockRow): RoutineBlock {
  return {
    id: r.external_id,
    externalId: r.external_id,
    label: r.label,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    category: r.category,
    daysOfWeek: r.days_of_week,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listRoutineBlocks(): Promise<RoutineBlock[]> {
  const { data, error } = await supabase.from('calendar_template_blocks').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerRoutineBlockRow[]).map(routineBlockFromServer);
}

export async function upsertRoutineBlock(block: RoutineBlock): Promise<void> {
  const { error } = await supabase
    .from('calendar_template_blocks')
    .upsert(routineBlockToServer(block), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function deleteRoutineBlock(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_template_blocks')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------- overrides */

interface ServerOverrideRow {
  external_id: string;
  date: string;
  blocks: ResolvedBlock[];
  updated_at?: string;
}

function overrideToServer(o: DayOverride) {
  return {
    external_id: o.externalId,
    date: o.date,
    blocks: o.blocks,
  };
}

function overrideFromServer(r: ServerOverrideRow): DayOverride {
  return {
    id: r.external_id,
    externalId: r.external_id,
    date: r.date,
    blocks: r.blocks,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listOverrides(): Promise<DayOverride[]> {
  const { data, error } = await supabase.from('calendar_overrides').select('*');
  if (error) throw new Error(error.message);
  return (data as ServerOverrideRow[]).map(overrideFromServer);
}

/**
 * Conflict target is (user_id, date), not external_id — date is the true
 * natural key for "one override per day". Overrides are hard-deleted (see
 * the migration's comment), so a plain unique index + this onConflict is
 * enough; no soft-delete collision to work around.
 */
export async function upsertOverride(override: DayOverride): Promise<void> {
  const { error } = await supabase
    .from('calendar_overrides')
    .upsert(overrideToServer(override), { onConflict: 'user_id,date' });
  if (error) throw new Error(error.message);
}

export async function deleteOverride(externalId: string): Promise<void> {
  const { error } = await supabase.from('calendar_overrides').delete().eq('external_id', externalId);
  if (error) throw new Error(error.message);
}
