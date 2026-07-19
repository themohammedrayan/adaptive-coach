import { supabase } from '../lib/supabase';
import type { ChatHistoryTurn, CoachChatTurn, UnifiedCoachPayload } from './types';

interface CoachChatTurnRow {
  id: string;
  question: string;
  answer: string;
  source: 'model' | 'fallback';
  model: string | null;
  generated_at: string;
  payload_hash: string;
}

function fromServerRow(r: CoachChatTurnRow): CoachChatTurn {
  return {
    id: r.id,
    question: r.question,
    answer: r.answer,
    source: r.source,
    model: r.model,
    generatedAt: r.generated_at,
    payloadHash: r.payload_hash,
  };
}

/**
 * v2 — calls the coach-chat Edge Function. Same contract as
 * coaching/remote.ts:generateCoachNote — the function already resolves the
 * failure/fallback path server-side; a thrown error here means the invoke
 * call itself failed (offline device, DNS, function unreachable).
 */
export async function askCoach(
  requestId: string,
  question: string,
  payload: UnifiedCoachPayload,
  history: ChatHistoryTurn[] = [],
): Promise<CoachChatTurn> {
  const { data, error } = await supabase.functions.invoke<{ turn: CoachChatTurn }>('coach-chat', {
    body: { requestId, question, payload, history },
  });
  if (error) throw error;
  if (!data) throw new Error('coach-chat: empty response');
  return data.turn;
}

/** v2 — the chat feed, oldest-first (reverse of listCoachNotes' newest-first, to render top-to-bottom). */
export async function listCoachChatTurns(limit = 50): Promise<CoachChatTurn[]> {
  const { data, error } = await supabase
    .from('coach_chat_turns')
    .select('id, question, answer, source, model, generated_at, payload_hash')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as CoachChatTurnRow[]).map(fromServerRow).reverse();
}
