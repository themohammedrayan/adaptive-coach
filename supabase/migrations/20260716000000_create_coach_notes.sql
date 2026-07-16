-- Coaching BRD §8 — coach_notes storage. Writes are Edge-Function-only
-- (service-role client); clients get read-only access to their own rows.
create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_of date not null,
  change_explanation text not null,
  weekly_review text not null,
  stall_read text not null,
  suggestion text not null,
  source text not null check (source in ('model', 'fallback')),
  model text,
  generated_at timestamptz not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_of)
);

alter table public.coach_notes enable row level security;

-- Reads only — no INSERT/UPDATE/DELETE policy exists, so authenticated/anon
-- clients have zero write privileges (RLS default-deny). All writes go
-- through the Edge Function's service-role client (supabase/functions/coach-note).
create policy "select own coach notes"
  on public.coach_notes for select
  using (auth.uid() = user_id);

create index coach_notes_user_week_idx on public.coach_notes (user_id, week_of desc);
