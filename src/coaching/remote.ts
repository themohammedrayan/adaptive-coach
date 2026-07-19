import { supabase } from '../lib/supabase';
import type { CoachNote, CoachPayload } from './types';

interface CoachNoteRow {
  id: string;
  week_of: string;
  change_explanation: string;
  weekly_review: string;
  stall_read: string;
  suggestion: string;
  goals_note: string;
  source: 'model' | 'fallback';
  model: string | null;
  generated_at: string;
  payload_hash: string;
}

function fromServerRow(r: CoachNoteRow): CoachNote {
  return {
    id: r.id,
    weekOf: r.week_of,
    changeExplanation: r.change_explanation,
    weeklyReview: r.weekly_review,
    stallRead: r.stall_read,
    suggestion: r.suggestion,
    goalsNote: r.goals_note,
    source: r.source,
    model: r.model,
    generatedAt: r.generated_at,
    payloadHash: r.payload_hash,
  };
}

/**
 * Coaching BRD §3/§10 — calls the Edge Function. The function already
 * resolves the failure/fallback path server-side (BRD §7); a thrown error
 * here means the invoke call itself failed (offline device, DNS, function
 * unreachable), not that Claude failed.
 */
export async function generateCoachNote(payload: CoachPayload): Promise<CoachNote> {
  const { data, error } = await supabase.functions.invoke<{ note: CoachNote }>('coach-note', {
    body: { payload },
  });
  if (error) throw error;
  if (!data) throw new Error('coach-note: empty response');
  return data.note;
}

/** Coaching BRD §8 — the feed, newest-first. */
export async function listCoachNotes(limit = 52): Promise<CoachNote[]> {
  const { data, error } = await supabase
    .from('coach_notes')
    .select(
      'id, week_of, change_explanation, weekly_review, stall_read, suggestion, goals_note, source, model, generated_at, payload_hash',
    )
    .order('week_of', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as CoachNoteRow[]).map(fromServerRow);
}

export async function getLatestCoachNote(): Promise<CoachNote | null> {
  const notes = await listCoachNotes(1);
  return notes[0] ?? null;
}
