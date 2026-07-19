create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  food_external_id text not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  quantity numeric not null,
  unit_id text not null,
  grams numeric not null,
  logged_at timestamptz not null,
  local_date date not null,
  kcal numeric not null,
  protein numeric,
  carb numeric,
  fat numeric,
  fiber numeric,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index log_entries_user_date_idx on public.log_entries (user_id, local_date);

alter table public.log_entries enable row level security;

create policy "own rows select" on public.log_entries
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.log_entries
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.log_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.log_entries
  for delete using (user_id = auth.uid());

create trigger log_entries_set_updated_at
  before update on public.log_entries
  for each row execute function set_updated_at();
