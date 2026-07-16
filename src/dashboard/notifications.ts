import * as Notifications from 'expo-notifications';

/** Thin seam over expo-notifications; faked in tests (no native module there). */
export interface NotificationsAdapter {
  getPermissionsAsync(): Promise<Notifications.NotificationPermissionsStatus>;
  requestPermissionsAsync(): Promise<Notifications.NotificationPermissionsStatus>;
  scheduleNotificationAsync(request: Notifications.NotificationRequestInput): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
}

export const defaultAdapter: NotificationsAdapter = {
  getPermissionsAsync: () => Notifications.getPermissionsAsync(),
  requestPermissionsAsync: () => Notifications.requestPermissionsAsync(),
  scheduleNotificationAsync: (request) => Notifications.scheduleNotificationAsync(request),
  cancelScheduledNotificationAsync: (identifier) =>
    Notifications.cancelScheduledNotificationAsync(identifier),
};

/** Dashboard BRD §B1 — foreground display behavior; call once from DashboardScreen's mount effect. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
