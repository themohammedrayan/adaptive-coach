create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  food_external_id text not null,
  meal_hint text,
  added_at timestamptz not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, food_external_id)
);

alter table public.favorites enable row level security;

create policy "own rows select" on public.favorites
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.favorites
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.favorites
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.favorites
  for delete using (user_id = auth.uid());

create trigger favorites_set_updated_at
  before update on public.favorites
  for each row execute function set_updated_at();
