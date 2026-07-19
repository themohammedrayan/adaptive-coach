import { supabase } from '../lib/supabase';
import type { Goal, GoalStatus, GoalType, Habit, HabitLogEntry, MilestoneItem, SourceBinding } from './types';

/* ----------------------------------------------------------------- goals */

interface ServerGoalRow {
  external_id: string;
  type: GoalType;
  title: string;
  status: GoalStatus;
  priority: number;
  blocked_by_goal_id: string | null;
  source_binding: SourceBinding;
  target_date: string | null;
  created_at?: string;
  updated_at?: string;
}

function goalToServer(g: Goal) {
  return {
    external_id: g.externalId,
    type: g.type,
    title: g.title,
    status: g.status,
    priority: g.priority,
    // blocked_by_goal_id is a real FK to goals.id (not external_id) — the
    // caller resolves externalId -> id before calling upsertGoal if needed.
    blocked_by_goal_id: g.blockedByGoalId,
    source_binding: g.sourceBinding,
    target_date: g.targetDate,
  };
}

function goalFromServer(r: ServerGoalRow): Goal {
  return {
    id: r.external_id,
    externalId: r.external_id,
    type: r.type,
    title: r.title,
    status: r.status,
    priority: r.priority,
    blockedByGoalId: r.blocked_by_goal_id,
    sourceBinding: r.source_binding,
    targetDate: r.target_date,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from('goals').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerGoalRow[]).map(goalFromServer);
}

export async function upsertGoal(goal: Goal): Promise<void> {
  const { error } = await supabase.from('goals').upsert(goalToServer(goal), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function archiveGoal(externalId: string, archivedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'archived', archived_at: archivedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

export async function softDeleteGoal(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase.from('goals').update({ deleted_at: deletedAtIso }).eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- habits */

interface ServerHabitRow {
  external_id: string;
  name: string;
  cadence_kind: 'count_per_window';
  target_count: number;
  window_days: number;
  archived_at: string | null;
  updated_at?: string;
}

function habitToServer(h: Habit) {
  return {
    external_id: h.externalId,
    name: h.name,
    cadence_kind: h.cadenceKind,
    target_count: h.targetCount,
    window_days: h.windowDays,
    archived_at: h.archivedAt,
  };
}

function habitFromServer(r: ServerHabitRow): Habit {
  return {
    id: r.external_id,
    externalId: r.external_id,
    name: r.name,
    cadenceKind: r.cadence_kind,
    targetCount: r.target_count,
    windowDays: r.window_days,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listHabits(): Promise<Habit[]> {
  const { data, error } = await supabase.from('habits').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerHabitRow[]).map(habitFromServer);
}

export async function upsertHabit(habit: Habit): Promise<void> {
  const { error } = await supabase.from('habits').upsert(habitToServer(habit), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function archiveHabit(externalId: string, archivedAtIso: string): Promise<void> {
  const { error } = await supabase.from('habits').update({ archived_at: archivedAtIso }).eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- habit_log */

interface ServerHabitLogRow {
  external_id: string;
  habit_external_id: string;
  occurred_on: string;
  note: string | null;
  source: 'manual';
  updated_at?: string;
}

function habitLogToServer(e: HabitLogEntry) {
  return {
    external_id: e.externalId,
    habit_external_id: e.habitExternalId,
    occurred_on: e.occurredOn,
    note: e.note,
    source: e.source,
  };
}

function habitLogFromServer(r: ServerHabitLogRow): HabitLogEntry {
  return {
    id: r.external_id,
    externalId: r.external_id,
    habitExternalId: r.habit_external_id,
    occurredOn: r.occurred_on,
    note: r.note,
    source: r.source,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listHabitLogEntries(): Promise<HabitLogEntry[]> {
  const { data, error } = await supabase.from('habit_log').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerHabitLogRow[]).map(habitLogFromServer);
}

/** Insert-only (each entry represents one immutable check-in); onConflict matches the day-uniqueness constraint so a repeat toggle-on for the same day is a no-op, not a duplicate row. */
export async function upsertHabitLogEntry(entry: HabitLogEntry): Promise<void> {
  const { error } = await supabase
    .from('habit_log')
    .upsert(habitLogToServer(entry), { onConflict: 'user_id,habit_external_id,occurred_on' });
  if (error) throw new Error(error.message);
}

export async function deleteHabitLogEntry(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase.from('habit_log').update({ deleted_at: deletedAtIso }).eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ----------------------------------------------------- goal_milestone_items */

interface ServerMilestoneItemRow {
  external_id: string;
  goal_external_id: string;
  title: string;
  sort_order: number;
  checked_at: string | null;
  updated_at?: string;
}

function milestoneItemToServer(m: MilestoneItem) {
  return {
    external_id: m.externalId,
    goal_external_id: m.goalExternalId,
    title: m.title,
    sort_order: m.sortOrder,
    checked_at: m.checkedAt,
  };
}

function milestoneItemFromServer(r: ServerMilestoneItemRow): MilestoneItem {
  return {
    id: r.external_id,
    externalId: r.external_id,
    goalExternalId: r.goal_external_id,
    title: r.title,
    sortOrder: r.sort_order,
    checkedAt: r.checked_at,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listMilestoneItems(): Promise<MilestoneItem[]> {
  const { data, error } = await supabase.from('goal_milestone_items').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerMilestoneItemRow[]).map(milestoneItemFromServer);
}

export async function upsertMilestoneItem(item: MilestoneItem): Promise<void> {
  const { error } = await supabase
    .from('goal_milestone_items')
    .upsert(milestoneItemToServer(item), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function deleteMilestoneItem(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('goal_milestone_items')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}
