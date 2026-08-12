import { Platform } from 'react-native';
import type { ChallengeProgress } from '../dashboard/challenge';
import type { IsoDate } from '../engine';
import { buildWallpaperSnapshot } from './snapshot';

/** Last fitness progress pushed this session — reused by scheduleFinanceWallpaperSync, since the native side has no read-back API to merge into. */
let lastProgress: { progress: ChallengeProgress; updatedAt: IsoDate } | null = null;
let financeSyncTimer: ReturnType<typeof setTimeout> | null = null;
const FINANCE_SYNC_DEBOUNCE_MS = 3000;

async function pushSnapshot(progress: ChallengeProgress, updatedAt: IsoDate): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { writeSnapshot } = await import('../../modules/live-wallpaper');
    const { computeFinanceWallpaperBits } = await import('../finance/wallpaperBits');
    const financeBits = await computeFinanceWallpaperBits(updatedAt).catch(() => null);
    const snapshot = buildWallpaperSnapshot(progress, updatedAt, financeBits);
    writeSnapshot(JSON.stringify(snapshot));
  } catch (e) {
    console.warn('syncWallpaperSnapshot failed', e);
  }
}

/**
 * Pushes the current challenge progress to the live wallpaper and offers the
 * system "set as wallpaper" picker. Both are best-effort: a failure here must
 * never surface as a dashboard/profile error (the wallpaper is a bonus
 * surface, not a data path), and neither does anything on iOS/web since the
 * native module only ships an Android implementation.
 */
export async function syncWallpaperSnapshot(progress: ChallengeProgress, updatedAt: IsoDate): Promise<void> {
  lastProgress = { progress, updatedAt };
  await pushSnapshot(progress, updatedAt);
}

/**
 * Debounced finance-only refresh, called after a finance mutation succeeds
 * so the wallpaper's debt ring updates on activity rather than only on
 * dashboard/profile opens. A no-op before the first full sync this session
 * (nothing to reuse for the fitness half of the snapshot) and on iOS/web.
 */
export function scheduleFinanceWallpaperSync(today: IsoDate): void {
  if (Platform.OS !== 'android' || lastProgress === null) return;
  if (financeSyncTimer !== null) clearTimeout(financeSyncTimer);
  financeSyncTimer = setTimeout(() => {
    financeSyncTimer = null;
    if (lastProgress !== null) void pushSnapshot(lastProgress.progress, today);
  }, FINANCE_SYNC_DEBOUNCE_MS);
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
