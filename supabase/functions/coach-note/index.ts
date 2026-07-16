// Coaching BRD §3/§10 — the Edge Function. Runs on Deno; the model API
// key lives only here (never on the device). Contract:
//   POST /coach-note  { Authorization: Bearer <user JWT>, body: { payload } }
//   -> 200 { note: CoachNote }  |  4xx/5xx { error: string }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { canonicalize, sha256Hex } from '../_shared/hash.ts';
import { COACH_NOTE_JSON_SCHEMA, SYSTEM_PROMPT } from '../_shared/prompt.ts';
import { fallbackNote, validateNote } from '../_shared/coachNoteLogic.ts';
import type { CoachNote, CoachNoteContent, CoachPayload } from '../_shared/types.ts';

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

interface CoachNoteRow {
  id: string;
  week_of: string;
  change_explanation: string;
  weekly_review: string;
  stall_read: string;
  suggestion: string;
  source: 'model' | 'fallback';
  model: string | null;
  generated_at: string;
  payload_hash: string;
}

function fromRow(row: CoachNoteRow): CoachNote {
  return {
    id: row.id,
    weekOf: row.week_of,
    changeExplanation: row.change_explanation,
    weeklyReview: row.weekly_review,
    stallRead: row.stall_read,
    suggestion: row.suggestion,
    source: row.source,
    model: row.model,
    generatedAt: row.generated_at,
    payloadHash: row.payload_hash,
  };
}

function toRow(userId: string, note: CoachNote): Omit<CoachNoteRow, 'id'> & { user_id: string } {
  return {
    user_id: userId,
    week_of: note.weekOf,
    change_explanation: note.changeExplanation,
    weekly_review: note.weeklyReview,
    stall_read: note.stallRead,
    suggestion: note.suggestion,
    source: note.source,
    model: note.model,
    generated_at: note.generatedAt,
    payload_hash: note.payloadHash,
  };
}

async function callModel(payload: CoachPayload): Promise<CoachNoteContent | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY') ?? ''}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_completion_tokens: 1024,
        // Small narrative task, not deep reasoning — keep it fast and cheap.
        reasoning_effort: 'minimal',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'coach_note', strict: true, schema: COACH_NOTE_JSON_SCHEMA },
        },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const message = data.choices?.[0]?.message;
    if (!message || message.refusal || typeof message.content !== 'string') return null;
    const parsed = JSON.parse(message.content);
    const fields: (keyof CoachNoteContent)[] = [
      'changeExplanation',
      'weeklyReview',
      'stallRead',
      'suggestion',
    ];
    return fields.every((f) => typeof parsed[f] === 'string') ? (parsed as CoachNoteContent) : null;
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

  let payload: CoachPayload;
  try {
    const body = await req.json();
    payload = body.payload;
    if (!payload || typeof payload.weekOf !== 'string') throw new Error('bad payload');
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  // Service-role client bypasses RLS — every query below filters by user.id manually.
  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Coaching BRD §9/§11 AT6 — idempotent rate limit: one generation per weekOf per user.
  const { data: existing } = await db
    .from('coach_notes')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_of', payload.weekOf)
    .maybeSingle();
  if (existing) return json({ note: fromRow(existing as CoachNoteRow) }, 200);

  const payloadHash = await sha256Hex(canonicalize(payload));
  let content: CoachNoteContent;
  let source: 'model' | 'fallback';
  let model: string | null;

  try {
    const modelNote = await callModel(payload);
    if (modelNote && validateNote(modelNote, payload)) {
      content = modelNote;
      source = 'model';
      model = MODEL_ID;
    } else {
      content = fallbackNote(payload);
      source = 'fallback';
      model = null;
    }
  } catch {
    content = fallbackNote(payload);
    source = 'fallback';
    model = null;
  }

  const note: CoachNote = {
    id: crypto.randomUUID(),
    weekOf: payload.weekOf,
    ...content,
    source,
    model,
    generatedAt: new Date().toISOString(),
    payloadHash,
  };

  const { error: insertError } = await db.from('coach_notes').insert(toRow(user.id, note));
  if (insertError) {
    if (insertError.code === '23505') {
      // Concurrent request for the same week won the race — return its row.
      const { data: winner } = await db
        .from('coach_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_of', payload.weekOf)
        .single();
      return json({ note: fromRow(winner as CoachNoteRow) }, 200);
    }
    return json({ error: insertError.message }, 500);
  }

  return json({ note }, 200);
});
