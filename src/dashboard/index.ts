export * from './types';
export { ACTIVITY_LEVELS, DEFAULT_REMINDER_CONFIG } from './constants';
export { projectedFinishCopy } from './copy';
export { isEmptyConsumption, toMacros } from './adapters';
export { buildBodyFatSeries, buildWeightSeries } from './series';
export { buildAdherenceSummary, type AdherenceSummary } from './adherence';
export { nextEveningTrigger, REMINDER_IDS } from './reminderSchedule';
export {
  configureNotificationHandler,
  defaultAdapter,
  type NotificationsAdapter,
} from './notifications';
export {
  cancelReminder,
  ensureNotificationPermission,
  notifyCoachNoteReady,
  scheduleReminders,
} from './reminders';
export type { DashboardStore } from './store';
export { MemoryStore } from './store.memory';
export { refreshDashboardSnapshot, type RefreshDeps } from './refreshSnapshot';
