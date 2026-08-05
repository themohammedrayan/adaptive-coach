-- Meal diary photos. Path into the private `meal-photos` bucket
-- (see 20260805090300_create_food_photo_buckets.sql); null for entries logged
-- without one, which is the overwhelming majority.
alter table public.log_entries add column photo_path text;
