create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  protein_per_100g numeric,
  carb_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  kcal_per_100g numeric not null,
  default_unit_id text not null,
  macros_complete boolean not null default true,
  created_at_utc timestamptz not null,
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index foods_user_idx on public.foods (user_id);

alter table public.foods enable row level security;

create policy "own rows select" on public.foods
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.foods
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.foods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.foods
  for delete using (user_id = auth.uid());

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function set_updated_at();
