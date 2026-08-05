import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import type { PickedPhoto } from './FoodDataContext';

/**
 * Camera/library picking for food photos, extracted so the estimate screen, the
 * create-food form, the coach log and the entry action sheet share one set of
 * options rather than four drifting copies.
 *
 * `base64: true` is required, not cosmetic: Supabase Storage uploads go through
 * base64-arraybuffer (see src/food-log/photos.ts), because handing React
 * Native's fetch-produced Blob to the client yields zero-byte objects. `quality:
 * 0.5` keeps a plate photo small enough to ride inside an Edge Function request
 * body.
 *
 * The camera/library permission strings are already declared in app.json, worded
 * for meals.
 */
export interface ImagePick {
  photo: PickedPhoto | null;
  error: string | null;
  pick: (source: 'camera' | 'library') => Promise<void>;
  clear: () => void;
  /** Seeds an existing photo, e.g. when re-opening an editor. */
  set: (photo: PickedPhoto | null) => void;
}

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  base64: true,
  quality: 0.5,
};

export function useImagePick(): ImagePick {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(async (source: 'camera' | 'library') => {
    try {
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(OPTIONS);
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        setError("Couldn't read that image.");
        return;
      }
      setPhoto({ uri: asset.uri, base64: asset.base64 });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return {
    photo,
    error,
    pick,
    clear: () => setPhoto(null),
    set: setPhoto,
  };
}
