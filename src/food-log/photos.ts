import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

/**
 * Catalog thumbnails. Universally readable, matching the food_catalog rows they
 * belong to, and with no delete policy — a thumbnail is as permanent as the food.
 */
export const FOOD_PHOTO_BUCKET = 'food-photos';

/**
 * The meal diary, including the photos that produced an AI estimate. Private,
 * own-folder only, exactly like progress-photos.
 */
export const MEAL_PHOTO_BUCKET = 'meal-photos';

/** Signed URLs are minted per view; an hour outlives any single screen visit. */
const SIGNED_URL_TTL_SECONDS = 3600;

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error('Not signed in');
  return userId;
}

/**
 * Uploads a food photo and returns its storage path.
 *
 * Mirrors src/data-sync/progressPhotos.ts: no offline outbox, because a failed
 * upload should surface for the user to retry rather than queue silently. The
 * caller keeps the local URI on the row so the image still renders, and
 * foodLogSyncOnOpen retries the upload on its next pass.
 *
 * The `{user_id}/…` path prefix is what the bucket's insert policy checks — do
 * not flatten it.
 */
async function upload(bucket: string, key: string, base64: string): Promise<string> {
  const userId = await requireUserId();
  const storagePath = `${userId}/${key}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return storagePath;
}

export function uploadCatalogPhoto(catalogId: string, base64: string): Promise<string> {
  return upload(FOOD_PHOTO_BUCKET, catalogId, base64);
}

export function uploadMealPhoto(entryId: string, base64: string): Promise<string> {
  return upload(MEAL_PHOTO_BUCKET, entryId, base64);
}

/** Both buckets are private, so display always goes through a signed URL. */
export async function signedPhotoUrl(
  bucket: string,
  storagePath: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
