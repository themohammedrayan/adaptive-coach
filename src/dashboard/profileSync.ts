import type { EngineResult, IsoDate } from '../engine';
import type { DashboardStore } from './store';
import type { PersonProfile, ReminderConfig } from './types';

export interface RemoteProfile {
  profile: PersonProfile;
  updatedAt: string;
}

/** Supabase seam for public.person_profiles; faked in tests. */
export interface ProfileRemote {
  fetch(): Promise<RemoteProfile | null>;
  upsert(row: RemoteProfile): Promise<void>;
}

/** Tiny async KV for the local profile edit time (AsyncStorage in the app). */
export interface SyncKV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | null): Promise<void>;
}

export const PROFILE_UPDATED_AT_KEY = 'adaptive-coach:profile-updated-at:v1';
/** A profile saved before sync existed has no stamp — any remote copy beats it. */
const EPOCH = new Date(0).toISOString();

export type ProfileSyncOutcome = 'pushed' | 'pulled' | 'unchanged' | 'empty';

/**
 * Two-way reconcile of the single profile row, last-write-wins on the
 * client edit time. Pulled profiles are written to the *base* store so
 * they aren't echoed back.
 */
export async function syncProfile(base: DashboardStore, remote: ProfileRemote, kv: SyncKV): Promise<ProfileSyncOutcome> {
  const local = await base.getProfile();
  const localAt = (await kv.get(PROFILE_UPDATED_AT_KEY)) ?? EPOCH;
  const r = await remote.fetch();

  if (local === null && r === null) return 'empty';
  if (r !== null && (local === null || r.updatedAt > localAt)) {
    await base.setProfile(r.profile);
    await kv.set(PROFILE_UPDATED_AT_KEY, r.updatedAt);
    return 'pulled';
  }
  if (local !== null && (r === null || localAt > r.updatedAt)) {
    // Never-stamped local profile + no remote: stamp it now so it has a real time.
    const updatedAt = localAt === EPOCH ? new Date().toISOString() : localAt;
    await remote.upsert({ profile: local, updatedAt });
    if (updatedAt !== localAt) await kv.set(PROFILE_UPDATED_AT_KEY, updatedAt);
    return 'pushed';
  }
  return 'unchanged';
}

/**
 * Write-through decorator over the device/web DashboardStore. Only the
 * profile syncs: the cached EngineResult is recomputable and reminder
 * config is per-device (notifications are scheduled on that device).
 */
export class SyncedDashboardStore implements DashboardStore {
  constructor(
    private readonly base: DashboardStore,
    private readonly remote: ProfileRemote,
    private readonly kv: SyncKV,
    private readonly nowUtc: () => string = () => new Date().toISOString(),
  ) {}

  getProfile() {
    return this.base.getProfile();
  }

  async setProfile(profile: PersonProfile): Promise<void> {
    const updatedAt = this.nowUtc();
    await this.base.setProfile(profile);
    await this.kv.set(PROFILE_UPDATED_AT_KEY, updatedAt);
    // Background push; if it fails (offline) the next syncProfile() pushes it.
    this.remote.upsert({ profile, updatedAt }).catch(() => {});
  }

  getLastResult() {
    return this.base.getLastResult();
  }
  setLastResult(computedAt: IsoDate, result: EngineResult) {
    return this.base.setLastResult(computedAt, result);
  }
  getReminderConfig() {
    return this.base.getReminderConfig();
  }
  setReminderConfig(config: ReminderConfig) {
    return this.base.setReminderConfig(config);
  }

  /** Local wipe only — account reset deletes the server row itself. */
  async clearAll(): Promise<void> {
    await this.base.clearAll();
    await this.kv.set(PROFILE_UPDATED_AT_KEY, null);
  }

  sync(): Promise<ProfileSyncOutcome> {
    return syncProfile(this.base, this.remote, this.kv);
  }
}
