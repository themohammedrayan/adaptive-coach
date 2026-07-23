import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import type { IdGenerator } from './manual';

const BUCKET = 'progress-photos';

const defaultGenId: IdGenerator = () =>
  `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface UploadProgressPhotoInput {
  base64: string;
  recordedAtUtc: string;
  localDate: string;
}

export interface ProgressPhotoRow {
  externalId: string;
  storagePath: string;
  recordedAtUtc: string;
  localDate: string;
}

/**
 * Uploads a progress photo to Storage and records it in progress_photos.
 * No offline outbox — unlike body_metrics, a failed upload (e.g. offline)
 * surfaces immediately for the user to retry, rather than queuing silently.
 */
export async function uploadProgressPhoto(
  input: UploadProgressPhotoInput,
  genId: IdGenerator = defaultGenId,
): Promise<ProgressPhotoRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const externalId = genId();
  const storagePath = `${userId}/${externalId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, decode(input.base64), { contentType: 'image/jpeg' });
  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from('progress_photos').insert({
    external_id: externalId,
    storage_path: storagePath,
    recorded_at_utc: input.recordedAtUtc,
    local_date: input.localDate,
  });
  if (insertError) throw new Error(insertError.message);

  return { externalId, storagePath, recordedAtUtc: input.recordedAtUtc, localDate: input.localDate };
}
