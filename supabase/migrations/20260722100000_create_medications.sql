create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  dose text not null,
  notes text,
  times_of_day integer[] not null default '{}',
  days_of_week integer[] not null default '{0,1,2,3,4,5,6}'
    check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]),
  start_date date not null,
  end_date date,
  reminder_enabled boolean not null default true,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index medications_user_idx on public.medications (user_id);

alter table public.medications enable row level security;

create policy "own rows select" on public.medications
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.medications
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.medications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.medications
  for delete using (user_id = auth.uid());

create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function set_updated_at();

-- One row per (medication, scheduled slot, day) the user has actually acted
-- on — never pre-materialized. A slot with no matching row is "pending",
-- computed client-side (src/medications/schedule.ts) by expanding the
-- medication's times_of_day/days_of_week against this table.
create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  medication_external_id text not null,
  scheduled_date date not null,
  scheduled_minute integer not null check (scheduled_minute >= 0 and scheduled_minute < 1440),
  status text not null check (status in ('taken', 'skipped', 'snoozed')),
  taken_at timestamptz,
  snoozed_until timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id),
  unique (user_id, medication_external_id, scheduled_date, scheduled_minute)
);

create index medication_doses_user_date_idx on public.medication_doses (user_id, scheduled_date);

alter table public.medication_doses enable row level security;

create policy "own rows select" on public.medication_doses
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.medication_doses
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.medication_doses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.medication_doses
  for delete using (user_id = auth.uid());

create trigger medication_doses_set_updated_at
  before update on public.medication_doses
  for each row execute function set_updated_at();
