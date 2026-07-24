import type { HealthConnectAdapter } from '../sync';

/**
 * Platform fallback (web / iOS): Health Connect is Android-only, so this stub
 * reports 'unavailable' and the app runs in manual-only mode (BRD §10).
 * Metro resolves adapter.android.ts instead on Android builds.
 */
export function createHealthConnectAdapter(): HealthConnectAdapter {
  return {
    async getSdkStatus() {
      return 'unavailable';
    },
    async ensurePermissions() {
      return [];
    },
    async read() {
      return { records: [], deletedExternalIds: [], nextChangesToken: null };
    },
    async mintChangesToken() {
      return null;
    },
  };
}
