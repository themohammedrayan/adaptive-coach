create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  parent_external_id text,
  is_system boolean not null default false,
  color text,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index finance_categories_user_kind_idx on public.finance_categories (user_id, kind);

alter table public.finance_categories enable row level security;

create policy "own rows select" on public.finance_categories
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.finance_categories
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.finance_categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.finance_categories
  for delete using (user_id = auth.uid());

create trigger finance_categories_set_updated_at
  before update on public.finance_categories
  for each row execute function set_updated_at();

-- Every user gets a fixed set of system categories (including a guaranteed
-- "Uncategorised" per kind) so report/logging code never has to handle a
-- missing-category branch. Seeded here (not client-side) so they exist the
-- instant a user account exists, with no "first Finance launch" special case.
create or replace function public.seed_finance_categories(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.finance_categories (user_id, external_id, name, kind, is_system)
  values
    (target_user_id, 'sys-exp-uncategorised', 'Uncategorised', 'expense', true),
    (target_user_id, 'sys-exp-food', 'Food', 'expense', true),
    (target_user_id, 'sys-exp-transport', 'Transport', 'expense', true),
    (target_user_id, 'sys-exp-bills', 'Bills & Utilities', 'expense', true),
    (target_user_id, 'sys-exp-shopping', 'Shopping', 'expense', true),
    (target_user_id, 'sys-exp-rent', 'Rent', 'expense', true),
    (target_user_id, 'sys-exp-health', 'Health', 'expense', true),
    (target_user_id, 'sys-exp-entertainment', 'Entertainment', 'expense', true),
    (target_user_id, 'sys-exp-other', 'Other', 'expense', true),
    (target_user_id, 'sys-inc-uncategorised', 'Uncategorised', 'income', true),
    (target_user_id, 'sys-inc-salary', 'Salary', 'income', true),
    (target_user_id, 'sys-inc-freelance', 'Freelance', 'income', true),
    (target_user_id, 'sys-inc-gifts', 'Gifts', 'income', true),
    (target_user_id, 'sys-inc-other', 'Other', 'income', true)
  on conflict (user_id, external_id) do nothing;
end;
$$;

revoke execute on function public.seed_finance_categories(uuid) from anon, authenticated, public;

create or replace function public.handle_new_user_seed_finance_categories()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.seed_finance_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_seed_finance_categories
  after insert on auth.users
  for each row execute function public.handle_new_user_seed_finance_categories();

-- Backfill for any user created before this migration.
select public.seed_finance_categories(id) from auth.users;
