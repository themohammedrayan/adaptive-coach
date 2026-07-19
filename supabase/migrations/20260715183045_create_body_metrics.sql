create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric_type text not null check (metric_type in ('weight', 'body_fat', 'lean_mass', 'bone_mass', 'height', 'bmr')),
  value_si numeric not null,
  source text not null check (source in ('manual', 'health_connect')),
  external_id text not null,
  data_origin text,
  recorded_at_utc timestamptz not null,
  local_date date not null,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, source, external_id)
);

create index body_metrics_user_type_date_idx
  on public.body_metrics (user_id, metric_type, local_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger body_metrics_set_updated_at
  before update on public.body_metrics
  for each row execute function public.set_updated_at();

alter table public.body_metrics enable row level security;

create policy "own rows select" on public.body_metrics
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.body_metrics
  for insert with check (user_id = auth.uid());
create policy "own rows update" on public.body_metrics
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows delete" on public.body_metrics
  for delete using (user_id = auth.uid());
