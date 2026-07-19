create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  type text not null check (type in ('expense', 'income', 'transfer', 'adjustment')),
  account_external_id text not null,
  counter_account_external_id text,
  category_external_id text,
  amount_minor bigint not null,
  currency char(3) not null default 'INR',
  note text,
  txn_date date not null,
  created_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'imported', 'recurring')),
  recurrence_external_id text,
  import_hash text,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  check ((type = 'adjustment' and amount_minor <> 0) or (type <> 'adjustment' and amount_minor > 0)),
  check ((type = 'transfer') = (counter_account_external_id is not null)),
  check ((type in ('transfer', 'adjustment')) = (category_external_id is null))
);

create index finance_transactions_user_date_idx on public.finance_transactions (user_id, txn_date);
create index finance_transactions_user_account_idx on public.finance_transactions (user_id, account_external_id);
create index finance_transactions_user_category_idx on public.finance_transactions (user_id, category_external_id);
create unique index finance_transactions_user_import_hash_idx on public.finance_transactions (user_id, import_hash) where import_hash is not null;

alter table public.finance_transactions enable row level security;

create policy "own rows select" on public.finance_transactions
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_transactions
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_transactions
  for delete using (user_id = auth.uid());

create trigger finance_transactions_set_updated_at
  before update on public.finance_transactions
  for each row execute function set_updated_at();
