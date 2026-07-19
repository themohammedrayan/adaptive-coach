create table public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  target_amount_minor bigint not null,
  currency char(3) not null default 'INR',
  linked_account_external_id text not null,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index finance_goals_user_status_idx on public.finance_goals (user_id, status);

alter table public.finance_goals enable row level security;

create policy "own rows select" on public.finance_goals
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_goals
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_goals
  for delete using (user_id = auth.uid());

create trigger finance_goals_set_updated_at
  before update on public.finance_goals
  for each row execute function set_updated_at();
