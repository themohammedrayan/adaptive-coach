-- Cross-device sync for state that used to live only in on-device SQLite:
-- the person profile (dashboard) and engine challenges (weight goals).
-- Both are last-write-wins on client_updated_at, the client clock at edit
-- time; updated_at is the server-side audit column like every other table.

create table public.person_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id),
  sex text not null check (sex in ('male', 'female')),
  age integer not null check (age between 1 and 120),
  height_cm numeric not null check (height_cm > 0),
  activity_factor numeric not null check (activity_factor > 0),
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.person_profiles enable row level security;

create policy "own rows select" on public.person_profiles
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.person_profiles
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.person_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.person_profiles
  for delete using (user_id = auth.uid());

create trigger person_profiles_set_updated_at
  before update on public.person_profiles
  for each row execute function set_updated_at();

-- Core challenge fields are columns; domain-specific fields (goalWeightKg,
-- horizonDays, prevTargetKcal, …) live in params so new domains need no
-- migration. Soft delete via status = 'deleted', never a row delete.
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  domain text not null,
  status text not null check (status in ('active', 'paused', 'completed', 'deleted')),
  is_primary boolean not null default false,
  start_date date not null,
  params jsonb not null default '{}'::jsonb,
  created_at_client timestamptz not null,
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table public.challenges enable row level security;

create policy "own rows select" on public.challenges
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.challenges
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.challenges
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.challenges
  for delete using (user_id = auth.uid());

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function set_updated_at();
