import { dayOfWeek, resolveDay } from '../resolve';
import type { DayOverride, RoutineBlock } from '../types';

const NOW = '2026-07-19T12:00:00.000Z';

function block(overrides: Partial<RoutineBlock>): RoutineBlock {
  return {
    id: 'x',
    externalId: 'x',
    label: 'Block',
    startMinute: 0,
    endMinute: 60,
    category: 'other',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    updatedAt: NOW,
    ...overrides,
  };
}

describe('dayOfWeek', () => {
  it('computes the weekday from a calendar date (2026-07-19 is a Sunday)', () => {
    expect(dayOfWeek('2026-07-19')).toBe(0);
    expect(dayOfWeek('2026-07-20')).toBe(1);
    expect(dayOfWeek('2026-07-25')).toBe(6);
  });
});

describe('resolveDay', () => {
  it('returns an empty day when there are no template blocks or overrides', () => {
    expect(resolveDay([], [], '2026-07-20')).toEqual([]);
  });

  it('filters template blocks by the date weekday and sorts by start time', () => {
    const templates: RoutineBlock[] = [
      block({ id: 'work', externalId: 'work', label: 'Work', startMinute: 570, endMinute: 1080, daysOfWeek: [1, 2, 3, 4, 5] }),
      block({ id: 'sleep', externalId: 'sleep', label: 'Sleep', startMinute: 0, endMinute: 420, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
      block({ id: 'weekend', externalId: 'weekend', label: 'Weekend', startMinute: 600, endMinute: 700, daysOfWeek: [0, 6] }),
    ];

    // Monday (2026-07-20): Sleep and Work apply, Weekend doesn't.
    const monday = resolveDay(templates, [], '2026-07-20');
    expect(monday.map((b) => b.label)).toEqual(['Sleep', 'Work']);

    // Sunday (2026-07-19): Sleep and Weekend apply, Work doesn't.
    const sunday = resolveDay(templates, [], '2026-07-19');
    expect(sunday.map((b) => b.label)).toEqual(['Sleep', 'Weekend']);
  });

  it('an override for the date wins wholesale over the template, sorted by start time', () => {
    const templates: RoutineBlock[] = [
      block({ label: 'Work', startMinute: 570, endMinute: 1080, daysOfWeek: [1, 2, 3, 4, 5] }),
    ];
    const overrides: DayOverride[] = [
      {
        id: 'ov',
        externalId: 'ov',
        date: '2026-07-20',
        blocks: [
          { label: 'Doctor', startMinute: 660, endMinute: 720, category: 'other' },
          { label: 'Sleep in', startMinute: 0, endMinute: 480, category: 'sleep' },
        ],
        updatedAt: NOW,
      },
    ];

    const result = resolveDay(templates, overrides, '2026-07-20');
    expect(result.map((b) => b.label)).toEqual(['Sleep in', 'Doctor']);
  });

  it('keeps an overnight block (endMinute > 1440) anchored to its start day', () => {
    const templates: RoutineBlock[] = [
      block({ label: 'Sleep', startMinute: 1380, endMinute: 1860, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
    ];
    const result = resolveDay(templates, [], '2026-07-20');
    expect(result).toEqual([expect.objectContaining({ label: 'Sleep', startMinute: 1380, endMinute: 1860 })]);
  });
});
