create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  type text not null check (type in ('bank', 'cash', 'credit_card', 'investment', 'loan', 'other')),
  balance_mode text not null check (balance_mode in ('ledger', 'valuation')),
  is_liability boolean not null default false,
  currency char(3) not null default 'INR',
  opening_balance_minor bigint not null default 0,
  opening_date date,
  interest_rate numeric,
  minimum_payment_minor bigint,
  due_day smallint check (due_day between 1 and 31),
  source text not null default 'manual' check (source in ('manual', 'imported')),
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index finance_accounts_user_type_idx on public.finance_accounts (user_id, type);

alter table public.finance_accounts enable row level security;

create policy "own rows select" on public.finance_accounts
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_accounts
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_accounts
  for delete using (user_id = auth.uid());

create trigger finance_accounts_set_updated_at
  before update on public.finance_accounts
  for each row execute function set_updated_at();
