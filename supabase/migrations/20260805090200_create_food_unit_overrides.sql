-- Per-food gram overrides ("a katori of dal is not a katori of rice").
--
-- These previously lived only in local SQLite (src/food-log/store.sqlite.ts) and
-- were silently lost on reinstall. Unlike food_catalog, an override is genuinely
-- personal — it records how big *your* katori is — so it keeps the standard
-- per-user envelope and RLS.

create table public.food_unit_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  food_catalog_id text not null,
  unit_id text not null,
  grams numeric not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index food_unit_overrides_user_food_idx
  on public.food_unit_overrides (user_id, food_catalog_id);

alter table public.food_unit_overrides enable row level security;

create policy "own rows select" on public.food_unit_overrides
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.food_unit_overrides
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.food_unit_overrides
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.food_unit_overrides
  for delete using (user_id = auth.uid());

create trigger food_unit_overrides_set_updated_at
  before update on public.food_unit_overrides
  for each row execute function set_updated_at();
