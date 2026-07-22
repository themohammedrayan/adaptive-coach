import * as Notifications from 'expo-notifications';

/**
 * Thin seam over expo-notifications, parallel to src/dashboard/notifications.ts's
 * NotificationsAdapter — plus getAllScheduledNotificationsAsync, which that
 * one doesn't need (dashboard has 3 fixed reminder ids; medications has a
 * dynamic N-schedule set that must be enumerated to rebuild). Faked in tests
 * (no native module there).
 */
export interface MedicationNotificationsAdapter {
  getPermissionsAsync(): Promise<Notifications.NotificationPermissionsStatus>;
  requestPermissionsAsync(): Promise<Notifications.NotificationPermissionsStatus>;
  scheduleNotificationAsync(request: Notifications.NotificationRequestInput): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  getAllScheduledNotificationsAsync(): Promise<{ identifier: string }[]>;
}

export const defaultAdapter: MedicationNotificationsAdapter = {
  getPermissionsAsync: () => Notifications.getPermissionsAsync(),
  requestPermissionsAsync: () => Notifications.requestPermissionsAsync(),
  scheduleNotificationAsync: (request) => Notifications.scheduleNotificationAsync(request),
  cancelScheduledNotificationAsync: (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
  getAllScheduledNotificationsAsync: () => Notifications.getAllScheduledNotificationsAsync(),
};
