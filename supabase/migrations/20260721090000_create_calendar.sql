create table public.calendar_template_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  label text not null,
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > start_minute and end_minute <= 2880),
  category text not null default 'other'
    check (category in ('sleep', 'work', 'travel', 'exercise', 'meals', 'other')),
  days_of_week integer[] not null default '{}'
    check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index calendar_template_blocks_user_idx on public.calendar_template_blocks (user_id);

alter table public.calendar_template_blocks enable row level security;

create policy "own rows select" on public.calendar_template_blocks
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.calendar_template_blocks
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.calendar_template_blocks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.calendar_template_blocks
  for delete using (user_id = auth.uid());

create trigger calendar_template_blocks_set_updated_at
  before update on public.calendar_template_blocks
  for each row execute function set_updated_at();

-- No deleted_at here (unlike every other table in this app): a soft-delete
-- would need a *partial* unique index on (user_id, date) to let a
-- delete-then-recreate for the same date reuse it, but supabase-js's
-- upsert(..., { onConflict }) always emits a plain `ON CONFLICT (cols)` with
-- no WHERE clause, which can't target a partial index — the write would
-- fail with "no unique or exclusion constraint matching ON CONFLICT".
-- Overrides don't need soft-delete's audit/sync value (no outbox, no
-- reconciliation engine for this module), so they're hard-deleted instead.
create table public.calendar_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  date date not null,
  blocks jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  unique (user_id, date)
);

alter table public.calendar_overrides enable row level security;

create policy "own rows select" on public.calendar_overrides
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.calendar_overrides
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.calendar_overrides
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.calendar_overrides
  for delete using (user_id = auth.uid());

create trigger calendar_overrides_set_updated_at
  before update on public.calendar_overrides
  for each row execute function set_updated_at();
