import type { CoachPayload } from '../types';

const mockInvoke = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Imported after the mock so remote.ts picks up the mocked module.
import { generateCoachNote, getLatestCoachNote, listCoachNotes } from '../remote';

function payload(): CoachPayload {
  return {
    weekOf: '2026-07-15',
    goal: { startWeightKg: 100, goalWeightKg: 80, horizonDays: 180, daysElapsed: 21 },
    current: {
      targetKcal: 1975,
      prevTargetKcal: 2100,
      deltaKcal: -125,
      macros: { proteinG: 180, fatG: 60, carbG: 170, fiberG: 28 },
      tdeeEst: 2450,
      effectiveDeficit: 475,
      weeklyRateKg: -0.35,
      projectedFinishDate: '2026-12-30',
      boundHit: 'moveLimit',
    },
    trend: [],
    adherence: { loggedDays: 11, windowDays: 14, avgIntake: 2010, avgTarget: 2050 },
    reasons: [],
  };
}

const ROW = {
  id: 'note-1',
  week_of: '2026-07-15',
  change_explanation: 'Your target moved to 1975 kcal.',
  weekly_review: 'You logged 11 of 14 days.',
  stall_read: 'On track.',
  suggestion: 'Keep it up.',
  source: 'model' as const,
  model: 'claude-sonnet-5',
  generated_at: '2026-07-15T09:00:00.000Z',
  payload_hash: 'abc123',
};

beforeEach(() => {
  mockInvoke.mockReset();
  mockOrder.mockReset();
  mockLimit.mockReset();
  mockSelect.mockReset();
  mockFrom.mockReset();
});

describe('generateCoachNote', () => {
  it('invokes the coach-note Edge Function and returns its note', async () => {
    mockInvoke.mockResolvedValue({ data: { note: { id: 'note-1' } }, error: null });
    const note = await generateCoachNote(payload());
    expect(mockInvoke).toHaveBeenCalledWith('coach-note', { body: { payload: payload() } });
    expect(note).toEqual({ id: 'note-1' });
  });

  it('throws when the invoke call itself fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(generateCoachNote(payload())).rejects.toThrow('network down');
  });
});

describe('listCoachNotes — Coaching BRD §11 AT6 support (reads the stored/cached note)', () => {
  it('maps server rows to CoachNote, newest-first', async () => {
    mockLimit.mockResolvedValue({ data: [ROW], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    const notes = await listCoachNotes(10);
    expect(mockFrom).toHaveBeenCalledWith('coach_notes');
    expect(mockOrder).toHaveBeenCalledWith('week_of', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(notes).toEqual([
      {
        id: 'note-1',
        weekOf: '2026-07-15',
        changeExplanation: 'Your target moved to 1975 kcal.',
        weeklyReview: 'You logged 11 of 14 days.',
        stallRead: 'On track.',
        suggestion: 'Keep it up.',
        source: 'model',
        model: 'claude-sonnet-5',
        generatedAt: '2026-07-15T09:00:00.000Z',
        payloadHash: 'abc123',
      },
    ]);
  });
});

describe('getLatestCoachNote', () => {
  it('returns the first note, or null when none exist', async () => {
    mockLimit.mockResolvedValueOnce({ data: [ROW], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
    expect(await getLatestCoachNote()).toEqual(expect.objectContaining({ id: 'note-1' }));

    mockLimit.mockResolvedValueOnce({ data: [], error: null });
    expect(await getLatestCoachNote()).toBeNull();
  });
});
