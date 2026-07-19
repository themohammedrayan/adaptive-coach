create table public.finance_recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  account_external_id text not null,
  counter_account_external_id text,
  category_external_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR',
  note text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval smallint not null default 1 check (interval > 0),
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  last_materialized_date date,
  active boolean not null default true,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  check ((type = 'transfer') = (counter_account_external_id is not null)),
  check ((type = 'transfer') = (category_external_id is null)),
  check (end_date is null or end_date >= start_date)
);

create index finance_recurring_transactions_user_active_idx
  on public.finance_recurring_transactions (user_id, active);

alter table public.finance_recurring_transactions enable row level security;

create policy "own rows select" on public.finance_recurring_transactions
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_recurring_transactions
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_recurring_transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_recurring_transactions
  for delete using (user_id = auth.uid());

create trigger finance_recurring_transactions_set_updated_at
  before update on public.finance_recurring_transactions
  for each row execute function set_updated_at();
