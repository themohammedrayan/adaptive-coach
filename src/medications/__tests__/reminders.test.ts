import type { NotificationPermissionsStatus, NotificationRequestInput } from 'expo-notifications';
import type { MedicationNotificationsAdapter } from '../notifications';
import { cancelAllMedicationRemindersCore, MEDICATION_REMINDER_PREFIX, rebuildMedicationRemindersCore } from '../reminders';
import type { Medication } from '../types';

function permission(granted: boolean): NotificationPermissionsStatus {
  return { granted, status: granted ? 'granted' : 'denied', canAskAgain: true, expires: 'never' } as NotificationPermissionsStatus;
}

class FakeMedicationNotificationsAdapter implements MedicationNotificationsAdapter {
  scheduled = new Map<string, NotificationRequestInput>();
  cancelled: string[] = [];

  async getPermissionsAsync() {
    return permission(true);
  }
  async requestPermissionsAsync() {
    return permission(true);
  }
  async scheduleNotificationAsync(request: NotificationRequestInput) {
    const id = request.identifier ?? 'generated-id';
    this.scheduled.set(id, request);
    return id;
  }
  async cancelScheduledNotificationAsync(identifier: string) {
    this.cancelled.push(identifier);
    this.scheduled.delete(identifier);
  }
  async getAllScheduledNotificationsAsync() {
    return [...this.scheduled.keys()].map((identifier) => ({ identifier }));
  }
}

function med(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    externalId: 'm1',
    name: 'Metformin',
    dose: '500 mg',
    notes: null,
    timesOfDay: [480],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: '2026-07-01',
    endDate: null,
    reminderEnabled: true,
    archivedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const TODAY = '2026-07-20';

describe('rebuildMedicationRemindersCore', () => {
  it('schedules a DAILY trigger at the right hour/minute for an every-day medication', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await rebuildMedicationRemindersCore([med({ timesOfDay: [510] })], { today: TODAY }, adapter);
    const scheduled = [...adapter.scheduled.values()];
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].trigger).toMatchObject({ type: 'daily', hour: 8, minute: 30 });
  });

  it('schedules one WEEKLY trigger per selected weekday for a partial-week medication', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    // Mon=1, Wed=3 in our 0=Sun..6=Sat scheme.
    await rebuildMedicationRemindersCore([med({ daysOfWeek: [1, 3], timesOfDay: [480] })], { today: TODAY }, adapter);
    const scheduled = [...adapter.scheduled.values()];
    expect(scheduled).toHaveLength(2);
    const weekdays = scheduled.map((r) => (r.trigger as { weekday: number }).weekday).sort();
    // expo-notifications weekday is 1-7, 1=Sunday -> our day 1 (Mon) is weekday 2, day 3 (Wed) is weekday 4.
    expect(weekdays).toEqual([2, 4]);
  });

  it('produces no schedule for an archived medication', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await rebuildMedicationRemindersCore([med({ archivedAt: '2026-07-10T00:00:00.000Z' })], { today: TODAY }, adapter);
    expect(adapter.scheduled.size).toBe(0);
  });

  it('produces no schedule when reminders are disabled', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await rebuildMedicationRemindersCore([med({ reminderEnabled: false })], { today: TODAY }, adapter);
    expect(adapter.scheduled.size).toBe(0);
  });

  it('produces no schedule for a medication whose end date has passed', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await rebuildMedicationRemindersCore([med({ endDate: '2026-07-19' })], { today: TODAY }, adapter);
    expect(adapter.scheduled.size).toBe(0);
  });

  it('cancels only previously-scheduled medication-dose ids, leaving unrelated ones untouched', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await adapter.scheduleNotificationAsync({
      identifier: 'dashboard-reminder-morning-weighin',
      content: { title: 'unrelated' },
      trigger: null,
    });
    await rebuildMedicationRemindersCore([med()], { today: TODAY }, adapter);

    expect(adapter.cancelled).not.toContain('dashboard-reminder-morning-weighin');
    expect(adapter.scheduled.has('dashboard-reminder-morning-weighin')).toBe(true);
    expect([...adapter.scheduled.keys()].some((id) => id.startsWith(MEDICATION_REMINDER_PREFIX))).toBe(true);
  });

  it('rebuilds cleanly on a second call — cancels its own prior schedule before rescheduling', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await rebuildMedicationRemindersCore([med({ timesOfDay: [480, 1200] })], { today: TODAY }, adapter);
    expect(adapter.scheduled.size).toBe(2);
    await rebuildMedicationRemindersCore([med({ timesOfDay: [480] })], { today: TODAY }, adapter);
    expect(adapter.scheduled.size).toBe(1);
  });
});

describe('cancelAllMedicationRemindersCore', () => {
  it('cancels every medication reminder without rescheduling', async () => {
    const adapter = new FakeMedicationNotificationsAdapter();
    await rebuildMedicationRemindersCore([med({ timesOfDay: [480, 1200] })], { today: TODAY }, adapter);
    expect(adapter.scheduled.size).toBe(2);
    await cancelAllMedicationRemindersCore(adapter);
    expect(adapter.scheduled.size).toBe(0);
  });
});
