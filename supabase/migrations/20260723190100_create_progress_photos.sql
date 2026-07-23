create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_id text not null,
  storage_path text not null,
  recorded_at_utc timestamptz not null,
  local_date date not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, external_id)
);

create index progress_photos_user_date_idx on public.progress_photos (user_id, local_date);

alter table public.progress_photos enable row level security;

create policy "own rows select" on public.progress_photos
  for select using (user_id = auth.uid());
create policy "own rows insert" on public.progress_photos
  for insert with check (user_id = auth.uid());
create policy "own rows delete" on public.progress_photos
  for delete using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Path convention: {user_id}/{externalId}.jpg — folder prefix ties storage
-- objects back to row ownership for the RLS check below.
create policy "own photos select" on storage.objects
  for select using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos insert" on storage.objects
  for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects
  for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
