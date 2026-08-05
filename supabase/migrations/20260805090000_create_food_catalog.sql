-- The shared, append-only food library.
--
-- Unlike every other table in this schema, a food_catalog row is NOT owned by
-- the user who created it: `created_by` is provenance only and is never used as
-- an RLS read filter. A food anyone creates is visible to everyone, forever —
-- deleting a log entry, archiving the food locally, or wiping the account never
-- removes the definition. That is the whole point of the table, and it is why
-- the identity key is a bare `unique (catalog_id)` rather than the
-- `unique (user_id, external_id)` used everywhere else.

create table public.food_catalog (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null unique,
  created_by uuid not null default auth.uid() references auth.users(id),
  name text not null,
  -- Lowercased/trimmed name, for search and near-duplicate detection.
  -- Deliberately NOT unique: two users may legitimately mean different things
  -- by "chicken curry", and a unique index would make one of them unable to
  -- contribute at all. De-duplication is advisory, done client-side.
  name_normalized text not null,
  protein_per_100g numeric,
  carb_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  kcal_per_100g numeric not null,
  default_unit_id text not null,
  macros_complete boolean not null default true,
  photo_path text,
  source text not null default 'manual' check (source in ('manual','estimate','coach')),
  created_at_utc timestamptz not null,
  updated_at timestamptz not null default now()
);

create index food_catalog_name_norm_idx on public.food_catalog (name_normalized);
create index food_catalog_updated_idx on public.food_catalog (updated_at);

alter table public.food_catalog enable row level security;

-- `using (true)` is intentional and is the feature: the catalog is universal.
-- Supabase's security advisor will flag this as a permissive SELECT policy;
-- that finding is expected and accepted, not a regression.
create policy "catalog read all" on public.food_catalog
  for select using (true);
create policy "catalog insert own" on public.food_catalog
  for insert with check (created_by = auth.uid());
-- Only the author may correct a row in place. Everyone else forks a new
-- catalog_id (see editFood in src/food-log/foods.ts) so one user can never
-- rewrite the numbers another user's history was snapshotted from.
create policy "catalog update own" on public.food_catalog
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

-- There is deliberately NO delete policy. RLS default-deny makes catalog rows
-- unreachable by any client DELETE — the same mechanism that makes coach_notes
-- client-read-only. Do not add one, and do not add food_catalog to
-- RESET_REMOTE_TABLES in src/lib/resetAccount.ts.

create trigger food_catalog_set_updated_at
  before update on public.food_catalog
  for each row execute function set_updated_at();

-- Backfill from the now-deprecated per-user public.foods. That table is left in
-- place (nothing reads or writes it after this migration) so no data is lost and
-- older installed builds keep working.
insert into public.food_catalog (
  catalog_id, created_by, name, name_normalized,
  protein_per_100g, carb_per_100g, fat_per_100g, fiber_per_100g,
  kcal_per_100g, default_unit_id, macros_complete, source, created_at_utc
)
select
  f.external_id, f.user_id, f.name, lower(btrim(f.name)),
  f.protein_per_100g, f.carb_per_100g, f.fat_per_100g, f.fiber_per_100g,
  f.kcal_per_100g, f.default_unit_id, f.macros_complete, 'manual', f.created_at_utc
from public.foods f
on conflict (catalog_id) do nothing;
