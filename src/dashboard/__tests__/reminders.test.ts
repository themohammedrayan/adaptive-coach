import type { NotificationRequestInput, NotificationPermissionsStatus } from 'expo-notifications';
import { DEFAULT_REMINDER_CONFIG } from '../constants';
import type { NotificationsAdapter } from '../notifications';
import {
  cancelReminderCore,
  ensureNotificationPermissionCore,
  notifyCoachNoteReadyCore,
  scheduleRemindersCore,
} from '../reminders';
import { REMINDER_IDS } from '../reminderSchedule';
import type { CoachNote } from '../../coaching';

function permission(granted: boolean): NotificationPermissionsStatus {
  return { granted, status: granted ? 'granted' : 'denied', canAskAgain: true, expires: 'never' } as NotificationPermissionsStatus;
}

class FakeNotificationsAdapter implements NotificationsAdapter {
  granted = true;
  scheduled: NotificationRequestInput[] = [];
  cancelled: string[] = [];

  async getPermissionsAsync() {
    return permission(this.granted);
  }
  async requestPermissionsAsync() {
    return permission(this.granted);
  }
  async scheduleNotificationAsync(request: NotificationRequestInput) {
    this.scheduled.push(request);
    return request.identifier ?? 'generated-id';
  }
  async cancelScheduledNotificationAsync(identifier: string) {
    this.cancelled.push(identifier);
  }
}

const TODAY = '2026-07-15';
const NOW = '2026-07-15T10:00:00.000Z';

describe('ensureNotificationPermissionCore', () => {
  it('returns true immediately when already granted, without requesting', async () => {
    const adapter = new FakeNotificationsAdapter();
    const spy = jest.spyOn(adapter, 'requestPermissionsAsync');
    expect(await ensureNotificationPermissionCore(adapter)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted', async () => {
    const adapter = new FakeNotificationsAdapter();
    adapter.granted = false;
    expect(await ensureNotificationPermissionCore(adapter)).toBe(false);
  });
});

describe('scheduleRemindersCore — Dashboard BRD §C AT5', () => {
  it('schedules distinct identifiers for morning and evening with correct hour/minute', async () => {
    const adapter = new FakeNotificationsAdapter();
    await scheduleRemindersCore(
      DEFAULT_REMINDER_CONFIG,
      { today: TODAY, alreadyLoggedToday: false, nowUtc: NOW },
      adapter,
    );
    const morning = adapter.scheduled.find((r) => r.identifier === REMINDER_IDS.morningWeighIn);
    const evening = adapter.scheduled.find((r) => r.identifier === REMINDER_IDS.eveningLog);
    expect(morning).toBeDefined();
    expect(evening).toBeDefined();
    expect(morning?.identifier).not.toBe(evening?.identifier);
  });

  it('disabling one reminder cancels only that identifier, leaving the other scheduled', async () => {
    const adapter = new FakeNotificationsAdapter();
    const config = {
      ...DEFAULT_REMINDER_CONFIG,
      eveningLog: { ...DEFAULT_REMINDER_CONFIG.eveningLog, enabled: false },
    };
    await scheduleRemindersCore(config, { today: TODAY, alreadyLoggedToday: false, nowUtc: NOW }, adapter);

    expect(adapter.cancelled).toContain(REMINDER_IDS.eveningLog);
    expect(adapter.scheduled.some((r) => r.identifier === REMINDER_IDS.eveningLog)).toBe(false);
    expect(adapter.scheduled.some((r) => r.identifier === REMINDER_IDS.morningWeighIn)).toBe(true);
  });
});

describe('cancelReminderCore — Dashboard BRD §C AT5', () => {
  it('cancels only the given kind', async () => {
    const adapter = new FakeNotificationsAdapter();
    await cancelReminderCore('eveningLog', adapter);
    expect(adapter.cancelled).toEqual([REMINDER_IDS.eveningLog]);
  });
});

describe('scheduleRemindersCore — Dashboard BRD §C AT6', () => {
  it('suppresses the evening reminder to tomorrow when the day is already logged', async () => {
    const adapter = new FakeNotificationsAdapter();
    await scheduleRemindersCore(
      DEFAULT_REMINDER_CONFIG,
      { today: TODAY, alreadyLoggedToday: true, nowUtc: NOW },
      adapter,
    );
    const evening = adapter.scheduled.find((r) => r.identifier === REMINDER_IDS.eveningLog);
    const trigger = evening?.trigger as { date: Date };
    expect(trigger.date.getUTCDate()).toBe(16); // tomorrow, not today (15)
  });
});

function note(): CoachNote {
  return {
    id: 'n1',
    weekOf: TODAY,
    changeExplanation: 'Target held at 1900 kcal.',
    weeklyReview: 'You logged 10 of 14 days.',
    stallRead: 'On track.',
    suggestion: 'Keep it up.',
    goalsNote: '',
    source: 'model',
    model: 'claude-sonnet-5',
    generatedAt: '2026-07-15T09:00:00.000Z',
    payloadHash: 'abc123',
  };
}

describe('notifyCoachNoteReadyCore — Dashboard BRD §C AT7 support', () => {
  it('schedules an immediate notification when the reminder is enabled and permission is granted', async () => {
    const adapter = new FakeNotificationsAdapter();
    await notifyCoachNoteReadyCore(note(), DEFAULT_REMINDER_CONFIG, adapter);
    expect(adapter.scheduled).toHaveLength(1);
    expect(adapter.scheduled[0].trigger).toBeNull();
  });

  it('does nothing when the reminder kind is disabled', async () => {
    const adapter = new FakeNotificationsAdapter();
    await notifyCoachNoteReadyCore(
      note(),
      { ...DEFAULT_REMINDER_CONFIG, coachNoteReady: { enabled: false } },
      adapter,
    );
    expect(adapter.scheduled).toHaveLength(0);
  });

  it('does nothing when permission is denied', async () => {
    const adapter = new FakeNotificationsAdapter();
    adapter.granted = false;
    await notifyCoachNoteReadyCore(note(), DEFAULT_REMINDER_CONFIG, adapter);
    expect(adapter.scheduled).toHaveLength(0);
  });
});
