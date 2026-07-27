import { Platform } from 'react-native';
import type { ChallengeProgress } from '../dashboard/challenge';
import type { IsoDate } from '../engine';
import { buildWallpaperSnapshot } from './snapshot';

/**
 * Pushes the current challenge progress to the live wallpaper and offers the
 * system "set as wallpaper" picker. Both are best-effort: a failure here must
 * never surface as a dashboard/profile error (the wallpaper is a bonus
 * surface, not a data path), and neither does anything on iOS/web since the
 * native module only ships an Android implementation.
 */
export async function syncWallpaperSnapshot(progress: ChallengeProgress, updatedAt: IsoDate): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { writeSnapshot } = await import('../../modules/live-wallpaper');
    const snapshot = buildWallpaperSnapshot(progress, updatedAt);
    writeSnapshot(JSON.stringify(snapshot));
  } catch (e) {
    console.warn('syncWallpaperSnapshot failed', e);
  }
}

export async function openWallpaperChooser(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { openWallpaperChooser: open } = await import('../../modules/live-wallpaper');
    open();
  } catch (e) {
    console.warn('openWallpaperChooser failed', e);
  }
}
