-- Two buckets, because food photos have two different privacy stories.
--
--   food-photos — catalog thumbnails. Universally readable, matching the
--                 food_catalog rows they belong to. Write is still confined to
--                 your own folder, and there is no delete policy at all, so a
--                 thumbnail is as permanent as the catalog row.
--   meal-photos — your meal diary, including the photos that produced an AI
--                 estimate. Private, own-folder only for every verb — a verbatim
--                 copy of the progress-photos policies.
--
-- Both are private buckets; display goes through createSignedUrl (see
-- src/food-log/photos.ts).

insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Path convention: {user_id}/{catalogId}.jpg
create policy "food photos read all" on storage.objects
  for select using (bucket_id = 'food-photos');
create policy "food photos insert own" on storage.objects
  for insert with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "food photos update own" on storage.objects
  for update using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- No delete policy for food-photos, deliberately — see food_catalog.

-- Path convention: {user_id}/{entryExternalId}.jpg
create policy "meal photos select own" on storage.objects
  for select using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal photos insert own" on storage.objects
  for insert with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal photos update own" on storage.objects
  for update using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "meal photos delete own" on storage.objects
  for delete using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
