import { supabase } from '../lib/supabase';
import type { FinanceChatHistoryTurn, FinanceCoachChatTurn, FinanceCoachPayload } from './types';

interface FinanceCoachChatTurnRow {
  id: string;
  question: string;
  answer: string;
  source: 'model' | 'fallback';
  model: string | null;
  generated_at: string;
  payload_hash: string;
}

function fromServerRow(r: FinanceCoachChatTurnRow): FinanceCoachChatTurn {
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

/** Calls the finance-coach-chat Edge Function — same contract as coach-chat/remote.ts:askCoach. */
export async function askFinanceCoach(
  requestId: string,
  question: string,
  payload: FinanceCoachPayload,
  history: FinanceChatHistoryTurn[] = [],
): Promise<FinanceCoachChatTurn> {
  const { data, error } = await supabase.functions.invoke<{ turn: FinanceCoachChatTurn }>('finance-coach-chat', {
    body: { requestId, question, payload, history },
  });
  if (error) throw error;
  if (!data) throw new Error('finance-coach-chat: empty response');
  return data.turn;
}

/** The chat feed, oldest-first (reverse of the DB's newest-first order), to render top-to-bottom. */
export async function listFinanceCoachChatTurns(limit = 50): Promise<FinanceCoachChatTurn[]> {
  const { data, error } = await supabase
    .from('finance_coach_chat_turns')
    .select('id, question, answer, source, model, generated_at, payload_hash')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as FinanceCoachChatTurnRow[]).map(fromServerRow).reverse();
}
