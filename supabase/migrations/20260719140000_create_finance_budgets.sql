create table public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  category_external_id text,
  amount_minor bigint not null,
  currency char(3) not null default 'INR',
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index finance_budgets_user_category_idx on public.finance_budgets (user_id, category_external_id);

alter table public.finance_budgets enable row level security;

create policy "own rows select" on public.finance_budgets
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_budgets
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_budgets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_budgets
  for delete using (user_id = auth.uid());

create trigger finance_budgets_set_updated_at
  before update on public.finance_budgets
  for each row execute function set_updated_at();
