create table public.finance_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  account_external_id text not null,
  amount_minor bigint not null,
  as_of_date date not null,
  source text not null default 'manual' check (source in ('manual', 'imported')),
  note text,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  unique (user_id, account_external_id, as_of_date)
);

create index finance_valuations_user_account_date_idx
  on public.finance_valuations (user_id, account_external_id, as_of_date desc);

alter table public.finance_valuations enable row level security;

create policy "own rows select" on public.finance_valuations
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_valuations
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_valuations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_valuations
  for delete using (user_id = auth.uid());

create trigger finance_valuations_set_updated_at
  before update on public.finance_valuations
  for each row execute function set_updated_at();
