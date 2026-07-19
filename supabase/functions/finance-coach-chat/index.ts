// Finance coach — ad-hoc Q&A. Sibling of coach-chat; same auth/DB/model
// skeleton, grounded in a FinanceCoachPayload instead of the weight
// CoachPayload, and stored in its own table since the two domains have
// entirely different payload shapes.
// Contract:
//   POST /finance-coach-chat  { Authorization: Bearer <user JWT>, body: { requestId, question, payload, history? } }
//   -> 200 { turn: FinanceCoachChatTurn }  |  4xx/5xx { error: string }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { canonicalize, sha256Hex } from '../_shared/hash.ts';
import { FINANCE_CHAT_ANSWER_JSON_SCHEMA, FINANCE_CHAT_SYSTEM_PROMPT } from '../_shared/financeChatPrompt.ts';
import { fallbackFinanceAnswer, validateFinanceChatAnswer } from '../_shared/financeChatLogic.ts';
import type { FinanceCoachChatTurn, FinanceCoachPayload } from '../_shared/financeTypes.ts';
import type { ChatAnswerContent } from '../_shared/types.ts';

const MODEL_ID = 'gpt-5-mini';
const MODEL_TIMEOUT_MS = 20_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

interface FinanceCoachChatTurnRow {
  id: string;
  request_id: string;
  question: string;
  answer: string;
  source: 'model' | 'fallback';
  model: string | null;
  generated_at: string;
  payload_hash: string;
}

function fromRow(row: FinanceCoachChatTurnRow): FinanceCoachChatTurn {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    source: row.source,
    model: row.model,
    generatedAt: row.generated_at,
    payloadHash: row.payload_hash,
  };
}

function toRow(
  userId: string,
  requestId: string,
  turn: FinanceCoachChatTurn,
): Omit<FinanceCoachChatTurnRow, 'id'> & { user_id: string } {
  return {
    user_id: userId,
    request_id: requestId,
    question: turn.question,
    answer: turn.answer,
    source: turn.source,
    model: turn.model,
    generated_at: turn.generatedAt,
    payload_hash: turn.payloadHash,
  };
}

interface ChatHistoryTurn {
  question: string;
  answer: string;
}

async function callModel(
  question: string,
  payload: FinanceCoachPayload,
  history: ChatHistoryTurn[],
): Promise<ChatAnswerContent | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const userContent = JSON.stringify({ payload, history, question });
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY') ?? ''}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_completion_tokens: 512,
        // Short conversational answer, not deep reasoning — keep it fast and cheap.
        reasoning_effort: 'minimal',
        messages: [
          { role: 'system', content: FINANCE_CHAT_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'finance_coach_chat_answer', strict: true, schema: FINANCE_CHAT_ANSWER_JSON_SCHEMA },
        },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const message = data.choices?.[0]?.message;
    if (!message || message.refusal || typeof message.content !== 'string') return null;
    const parsed = JSON.parse(message.content);
    return typeof parsed.answer === 'string' ? (parsed as ChatAnswerContent) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing authorization' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  let requestId: string;
  let question: string;
  let payload: FinanceCoachPayload;
  let history: ChatHistoryTurn[];
  try {
    const body = await req.json();
    requestId = body.requestId;
    question = body.question;
    payload = body.payload;
    history = Array.isArray(body.history) ? body.history : [];
    if (typeof requestId !== 'string' || requestId.length === 0) throw new Error('bad requestId');
    if (typeof question !== 'string' || question.trim().length === 0) throw new Error('bad question');
    if (!payload || typeof payload.today !== 'string') throw new Error('bad payload');
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  // Service-role client bypasses RLS — every query below filters by user.id manually.
  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Idempotent replay: a client-generated requestId lets a retry return the same turn.
  const { data: existing } = await db
    .from('finance_coach_chat_turns')
    .select('*')
    .eq('user_id', user.id)
    .eq('request_id', requestId)
    .maybeSingle();
  if (existing) return json({ turn: fromRow(existing as FinanceCoachChatTurnRow) }, 200);

  const payloadHash = await sha256Hex(canonicalize({ payload, history, question }));
  let content: ChatAnswerContent;
  let source: 'model' | 'fallback';
  let model: string | null;

  try {
    const modelAnswer = await callModel(question, payload, history);
    if (modelAnswer && validateFinanceChatAnswer(modelAnswer, payload)) {
      content = modelAnswer;
      source = 'model';
      model = MODEL_ID;
    } else {
      content = fallbackFinanceAnswer(payload);
      source = 'fallback';
      model = null;
    }
  } catch {
    content = fallbackFinanceAnswer(payload);
    source = 'fallback';
    model = null;
  }

  const turn: FinanceCoachChatTurn = {
    id: crypto.randomUUID(),
    question,
    ...content,
    source,
    model,
    generatedAt: new Date().toISOString(),
    payloadHash,
  };

  const { error: insertError } = await db
    .from('finance_coach_chat_turns')
    .insert(toRow(user.id, requestId, turn));
  if (insertError) {
    if (insertError.code === '23505') {
      // Concurrent request with the same requestId won the race — return its row.
      const { data: winner } = await db
        .from('finance_coach_chat_turns')
        .select('*')
        .eq('user_id', user.id)
        .eq('request_id', requestId)
        .single();
      return json({ turn: fromRow(winner as FinanceCoachChatTurnRow) }, 200);
    }
    return json({ error: insertError.message }, 500);
  }

  return json({ turn }, 200);
});
