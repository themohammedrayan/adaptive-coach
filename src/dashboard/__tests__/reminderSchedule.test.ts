import { nextEveningTrigger, REMINDER_IDS } from '../reminderSchedule';

describe('REMINDER_IDS', () => {
  it('has a distinct identifier per reminder kind', () => {
    const ids = Object.values(REMINDER_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('nextEveningTrigger — Dashboard BRD §C AT6', () => {
  const TODAY = '2026-07-15';

  it('fires tonight when not yet logged and the configured time is still ahead', () => {
    const trigger = nextEveningTrigger(TODAY, 21, 0, false, '2026-07-15T10:00:00.000Z');
    expect(trigger.getUTCFullYear()).toBe(2026);
    expect(trigger.getUTCMonth()).toBe(6); // 0-indexed July
    expect(trigger.getUTCDate()).toBe(15);
    expect(trigger.getUTCHours()).toBe(21);
    expect(trigger.getUTCMinutes()).toBe(0);
  });

  it('suppresses tonight and moves to tomorrow when the day is already logged (AT6)', () => {
    const trigger = nextEveningTrigger(TODAY, 21, 0, true, '2026-07-15T10:00:00.000Z');
    expect(trigger.getUTCDate()).toBe(16);
    expect(trigger.getUTCHours()).toBe(21);
  });

  it('moves to tomorrow when the configured time has already passed today', () => {
    const trigger = nextEveningTrigger(TODAY, 21, 0, false, '2026-07-15T22:00:00.000Z');
    expect(trigger.getUTCDate()).toBe(16);
    expect(trigger.getUTCHours()).toBe(21);
  });
});
