import { applyDateOverrideEdit, buildOverrideForDate, buildRoutineBlock } from '../crud';
import type { ResolvedBlock } from '../types';

const NOW = '2026-07-19T12:00:00.000Z';
let counter = 0;
const genId = () => `id-${++counter}`;

beforeEach(() => {
  counter = 0;
});

describe('buildRoutineBlock', () => {
  it('fills id/externalId/updatedAt from the generator and clock', () => {
    const block = buildRoutineBlock(
      { label: 'Sleep', startMinute: 1380, endMinute: 1860, category: 'sleep', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      NOW,
      genId,
    );
    expect(block).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      label: 'Sleep',
      startMinute: 1380,
      endMinute: 1860,
      category: 'sleep',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      updatedAt: NOW,
    });
  });
});

describe('buildOverrideForDate', () => {
  it('wraps the given blocks for the date', () => {
    const blocks: ResolvedBlock[] = [{ label: 'Doctor', startMinute: 600, endMinute: 660, category: 'other' }];
    const override = buildOverrideForDate('2026-07-20', blocks, NOW, genId);
    expect(override).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      date: '2026-07-20',
      blocks,
      updatedAt: NOW,
    });
  });
});

describe('applyDateOverrideEdit', () => {
  it('replaces the block at the given index, leaving the rest untouched', () => {
    const day: ResolvedBlock[] = [
      { label: 'Sleep', startMinute: 0, endMinute: 420, category: 'sleep' },
      { label: 'Work', startMinute: 570, endMinute: 1080, category: 'work' },
    ];
    const edited: ResolvedBlock = { label: 'Work from home', startMinute: 570, endMinute: 1080, category: 'work' };

    const result = applyDateOverrideEdit(day, 1, edited);
    expect(result).toEqual([day[0], edited]);
    // original array untouched
    expect(day[1].label).toBe('Work');
  });
});
