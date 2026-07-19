create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  type text not null check (type in ('metric', 'fund', 'habit', 'milestone')),
  title text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  priority integer not null default 0,
  blocked_by_goal_id uuid references public.goals(id),
  source_binding jsonb not null,
  target_date date,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index goals_user_status_idx on public.goals (user_id, status);

alter table public.goals enable row level security;

create policy "own rows select" on public.goals
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.goals
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.goals
  for delete using (user_id = auth.uid());

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function set_updated_at();

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  cadence_kind text not null default 'count_per_window'
    check (cadence_kind in ('count_per_window')),
  target_count integer not null,
  window_days integer not null,
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table public.habits enable row level security;

create policy "own rows select" on public.habits
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.habits
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.habits
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.habits
  for delete using (user_id = auth.uid());

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function set_updated_at();

create table public.habit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  habit_external_id text not null,
  occurred_on date not null,
  note text,
  source text not null default 'manual' check (source in ('manual')),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  unique (user_id, habit_external_id, occurred_on)
);

create index habit_log_user_habit_idx on public.habit_log (user_id, habit_external_id);

alter table public.habit_log enable row level security;

create policy "own rows select" on public.habit_log
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.habit_log
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.habit_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.habit_log
  for delete using (user_id = auth.uid());

create trigger habit_log_set_updated_at
  before update on public.habit_log
  for each row execute function set_updated_at();

create table public.goal_milestone_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  goal_external_id text not null,
  title text not null,
  sort_order integer not null default 0,
  checked_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index goal_milestone_items_user_goal_idx on public.goal_milestone_items (user_id, goal_external_id);

alter table public.goal_milestone_items enable row level security;

create policy "own rows select" on public.goal_milestone_items
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.goal_milestone_items
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.goal_milestone_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.goal_milestone_items
  for delete using (user_id = auth.uid());

create trigger goal_milestone_items_set_updated_at
  before update on public.goal_milestone_items
  for each row execute function set_updated_at();
