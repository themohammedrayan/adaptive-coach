// v2 — AI meal estimation. Unlike coach-note/coach-chat, this produces new
// numbers from an image/description rather than narrating known state, so
// it validates with a plausibility guard instead of number-tracing, and
// has no deterministic fallback — a failed/implausible estimate surfaces as
// 422 and the client falls back to manual entry. Nothing here is persisted
// server-side. Contract:
//   POST /estimate-meal  { Authorization: Bearer <user JWT>, body: { requestId, description?, imageBase64? } }
//   -> 200 { estimate: MealEstimate }
//   -> 422 { error: 'estimate_unavailable' }
//   -> 4xx/5xx { error: string }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { MEAL_ESTIMATE_JSON_SCHEMA, MEAL_ESTIMATE_SYSTEM_PROMPT } from '../_shared/mealEstimatePrompt.ts';
import { validateMealEstimate } from '../_shared/mealEstimateLogic.ts';
import type { MealEstimate, RawMealEstimate } from '../_shared/types.ts';

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

async function callModel(description: string | undefined, imageBase64: string | undefined): Promise<RawMealEstimate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const content: Array<Record<string, unknown>> = [];
    if (description) content.push({ type: 'text', text: description });
    if (imageBase64) {
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
    }

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
        reasoning_effort: 'minimal',
        messages: [
          { role: 'system', content: MEAL_ESTIMATE_SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'meal_estimate', strict: true, schema: MEAL_ESTIMATE_JSON_SCHEMA },
        },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const message = data.choices?.[0]?.message;
    if (!message || message.refusal || typeof message.content !== 'string') return null;
    const parsed = JSON.parse(message.content);
    const requiredFields: (keyof RawMealEstimate)[] = [
      'name',
      'proteinPer100g',
      'carbPer100g',
      'fatPer100g',
      'fiberPer100g',
      'estimatedGrams',
      'confidence',
    ];
    return requiredFields.every((f) => f in parsed) ? (parsed as RawMealEstimate) : null;
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

  let description: string | undefined;
  let imageBase64: string | undefined;
  try {
    const body = await req.json();
    description = typeof body.description === 'string' && body.description.trim() !== '' ? body.description : undefined;
    imageBase64 = typeof body.imageBase64 === 'string' && body.imageBase64.length > 0 ? body.imageBase64 : undefined;
    if (!description && !imageBase64) throw new Error('description or imageBase64 required');
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  let estimate: MealEstimate | null = null;
  try {
    const raw = await callModel(description, imageBase64);
    if (raw) estimate = validateMealEstimate(raw, MODEL_ID);
  } catch {
    estimate = null;
  }

  if (!estimate) return json({ error: 'estimate_unavailable' }, 422);
  return json({ estimate }, 200);
});
