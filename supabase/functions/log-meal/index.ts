// Conversational meal logging. Sibling of estimate-meal: it produces new
// numbers from a sentence and/or a photo rather than narrating known state, so
// it validates with a per-item plausibility guard instead of number-tracing, and
// has no deterministic fallback — a failed or implausible parse surfaces as 422
// and the client falls back to the manual add sheet.
//
// Nothing here is persisted server-side. The client creates the foods and log
// entries, and only after the user has approved each new food. Contract:
//   POST /log-meal  { Authorization: Bearer <user JWT>,
//                     body: { requestId, message?, imageBase64?, catalog: {catalogId,name}[] } }
//   -> 200 { result: MealLogResult }
//   -> 422 { error: 'estimate_unavailable' }
//   -> 4xx/5xx { error: string }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateMealLog } from '../_shared/mealLogLogic.ts';
import { MEAL_LOG_JSON_SCHEMA, MEAL_LOG_SYSTEM_PROMPT } from '../_shared/mealLogPrompt.ts';
import type { MealLogResult, RawMealLog } from '../_shared/types.ts';

const MODEL_ID = 'gpt-5-mini';
const MODEL_TIMEOUT_MS = 30_000;
/** Enough to ground a personal catalog; keeps the prompt small either way. */
const MAX_CATALOG_ENTRIES = 200;

interface CatalogEntry {
  catalogId: string;
  name: string;
}

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

async function callModel(
  message: string | undefined,
  imageBase64: string | undefined,
  catalog: CatalogEntry[],
): Promise<RawMealLog | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const content: Array<Record<string, unknown>> = [];
    // The catalog goes in as plain text alongside the description so the model
    // matches against it rather than inventing foods the user already has.
    const catalogText =
      catalog.length === 0
        ? 'The user has no saved foods yet. Set matchedCatalogId to null for every item.'
        : `The user's saved foods (JSON):\n${JSON.stringify(catalog)}`;
    content.push({ type: 'text', text: catalogText });
    if (message) content.push({ type: 'text', text: `What they ate: ${message}` });
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
        max_completion_tokens: 2048,
        reasoning_effort: 'minimal',
        messages: [
          { role: 'system', content: MEAL_LOG_SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'meal_log', strict: true, schema: MEAL_LOG_JSON_SCHEMA },
        },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    if (!msg || msg.refusal || typeof msg.content !== 'string') return null;
    const parsed = JSON.parse(msg.content);
    if (!Array.isArray(parsed?.items)) return null;
    return parsed as RawMealLog;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseCatalog(value: unknown): CatalogEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (e): e is CatalogEntry =>
        typeof e?.catalogId === 'string' && typeof e?.name === 'string' && e.catalogId.length > 0,
    )
    .slice(0, MAX_CATALOG_ENTRIES)
    .map((e) => ({ catalogId: e.catalogId, name: e.name }));
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

  let message: string | undefined;
  let imageBase64: string | undefined;
  let catalog: CatalogEntry[] = [];
  try {
    const body = await req.json();
    message = typeof body.message === 'string' && body.message.trim() !== '' ? body.message : undefined;
    imageBase64 = typeof body.imageBase64 === 'string' && body.imageBase64.length > 0 ? body.imageBase64 : undefined;
    catalog = parseCatalog(body.catalog);
    if (!message && !imageBase64) throw new Error('message or imageBase64 required');
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  let result: MealLogResult | null = null;
  try {
    const raw = await callModel(message, imageBase64, catalog);
    if (raw) {
      result = validateMealLog(
        raw,
        catalog.map((c) => c.catalogId),
        MODEL_ID,
      );
    }
  } catch {
    result = null;
  }

  if (!result) return json({ error: 'estimate_unavailable' }, 422);
  return json({ result }, 200);
});
