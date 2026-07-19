import { MemoryStore } from '../../challenges';
import {
  buildGoal,
  buildHabit,
  buildMilestoneItem,
  createMetricGoal,
  toggleHabitLogEntry,
  toggleMilestoneItem,
} from '../crud';

const NOW = '2026-07-19T12:00:00.000Z';
let counter = 0;
const genId = () => `id-${++counter}`;

beforeEach(() => {
  counter = 0;
});

describe('buildGoal', () => {
  it('fills defaults: active, priority 0, no predecessor, id === externalId', () => {
    const goal = buildGoal({ type: 'habit', title: 'Read weekly', sourceBinding: { type: 'habit', habitExternalId: 'h1' } }, NOW, genId);
    expect(goal).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      type: 'habit',
      title: 'Read weekly',
      status: 'active',
      priority: 0,
      blockedByGoalId: null,
      sourceBinding: { type: 'habit', habitExternalId: 'h1' },
      targetDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('honors explicit priority/blockedByGoalId/targetDate', () => {
    const goal = buildGoal(
      {
        type: 'milestone',
        title: 'Ship v1',
        sourceBinding: { type: 'milestone' },
        priority: 3,
        blockedByGoalId: 'goal-a',
        targetDate: '2026-12-31',
      },
      NOW,
      genId,
    );
    expect(goal.priority).toBe(3);
    expect(goal.blockedByGoalId).toBe('goal-a');
    expect(goal.targetDate).toBe('2026-12-31');
  });
});

describe('buildHabit', () => {
  it('builds a habit with count_per_window cadence', () => {
    const habit = buildHabit({ name: 'Read', targetCount: 5, windowDays: 7 }, NOW, genId);
    expect(habit).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      name: 'Read',
      cadenceKind: 'count_per_window',
      targetCount: 5,
      windowDays: 7,
      archivedAt: null,
      updatedAt: NOW,
    });
  });
});

describe('toggleHabitLogEntry', () => {
  it('builds a new entry when none exists for the day', () => {
    const entry = toggleHabitLogEntry('h1', '2026-07-19', null, NOW, genId);
    expect(entry).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      habitExternalId: 'h1',
      occurredOn: '2026-07-19',
      note: null,
      source: 'manual',
      updatedAt: NOW,
    });
  });

  it('returns null (remove) when an entry already exists for the day', () => {
    const existing = toggleHabitLogEntry('h1', '2026-07-19', null, NOW, genId)!;
    const toggled = toggleHabitLogEntry('h1', '2026-07-19', existing, NOW, genId);
    expect(toggled).toBeNull();
  });
});

describe('buildMilestoneItem / toggleMilestoneItem', () => {
  it('builds an unchecked item', () => {
    const item = buildMilestoneItem({ goalExternalId: 'g1', title: 'Buy license', sortOrder: 0 }, NOW, genId);
    expect(item.checkedAt).toBeNull();
  });

  it('toggles checkedAt on and back off', () => {
    const item = buildMilestoneItem({ goalExternalId: 'g1', title: 'Buy license', sortOrder: 0 }, NOW, genId);
    const checked = toggleMilestoneItem(item, '2026-07-19T13:00:00.000Z');
    expect(checked.checkedAt).toBe('2026-07-19T13:00:00.000Z');
    const unchecked = toggleMilestoneItem(checked, '2026-07-19T14:00:00.000Z');
    expect(unchecked.checkedAt).toBeNull();
  });
});

describe('createMetricGoal', () => {
  it('creates the Challenge and returns a wrapping metric goal bound to it', async () => {
    const store = new MemoryStore();
    const { challenge, goal } = await createMetricGoal(
      store,
      { title: 'Lose 10kg', goalWeightKg: 70, startWeightKg: 80, horizonDays: 180 },
      NOW,
      '2026-07-19',
      genId,
    );

    expect(await store.get(challenge.id)).toEqual(challenge);
    expect(goal.type).toBe('metric');
    expect(goal.sourceBinding).toEqual({ type: 'metric', challengeId: challenge.id });
    expect(challenge.goalWeightKg).toBe(70);
    expect(challenge.startWeightKg).toBe(80);
    expect(challenge.isPrimary).toBe(true);
  });
});
