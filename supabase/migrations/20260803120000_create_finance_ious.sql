-- Informal person-to-person debts, deliberately kept out of net worth: they are
-- small, uncertain, and netWorthAsOf feeds Reports, the health read, the coach
-- payload and the projection. The Debt tab shows their net position instead.
create table public.finance_ious (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  person_name text not null,
  direction text not null check (direction in ('owed_to_me', 'i_owe')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR',
  note text,
  incurred_date date not null,
  due_date date,
  settled_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  constraint finance_ious_due_after_incurred check (due_date is null or due_date >= incurred_date)
);

create index finance_ious_user_settled_idx on public.finance_ious (user_id, settled_at);

alter table public.finance_ious enable row level security;

create policy "own rows select" on public.finance_ious
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_ious
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_ious
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_ious
  for delete using (user_id = auth.uid());

create trigger finance_ious_set_updated_at
  before update on public.finance_ious
  for each row execute function set_updated_at();
