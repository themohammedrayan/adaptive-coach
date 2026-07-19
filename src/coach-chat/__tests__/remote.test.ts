import type { CoachPayload } from '../../coaching';
import type { FinanceCoachPayload } from '../../finance';
import type { UnifiedCoachPayload } from '../types';

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
import { askCoach, listCoachChatTurns } from '../remote';

const HEALTH: CoachPayload = {
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
  goals: [],
  goalsAggregate: { activeCount: 0, blockedCount: 0, completedThisWeekCount: 0 },
  goalSignals: [],
};

const FINANCE: FinanceCoachPayload = {
  today: '2026-07-15',
  currency: 'INR',
  netWorthMinor: 0,
  month: { incomeMinor: 0, expenseMinor: 0 },
  topExpenseCategories: [],
  accounts: [],
  goals: [],
  budgets: [],
  healthRead: { status: 'good', reasons: [] },
  projection: [],
};

function payload(): UnifiedCoachPayload {
  return {
    today: '2026-07-15',
    health: HEALTH,
    finance: FINANCE,
    goals: [],
    goalsAggregate: { activeCount: 0, blockedCount: 0, completedThisWeekCount: 0 },
    goalSignals: [],
  };
}

const ROW = {
  id: 'turn-1',
  question: 'Why did my target drop?',
  answer: 'Your trend stalled, so estimated burn dropped.',
  source: 'model' as const,
  model: 'gpt-5-mini',
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

describe('askCoach', () => {
  it('invokes the coach-chat Edge Function and returns its turn', async () => {
    mockInvoke.mockResolvedValue({ data: { turn: { id: 'turn-1' } }, error: null });
    const turn = await askCoach('req-1', 'Why did my target drop?', payload());
    expect(mockInvoke).toHaveBeenCalledWith('coach-chat', {
      body: { requestId: 'req-1', question: 'Why did my target drop?', payload: payload(), history: [] },
    });
    expect(turn).toEqual({ id: 'turn-1' });
  });

  it('passes through provided history', async () => {
    mockInvoke.mockResolvedValue({ data: { turn: { id: 'turn-2' } }, error: null });
    const history = [{ question: 'Q1', answer: 'A1' }];
    await askCoach('req-2', 'Follow-up?', payload(), history);
    expect(mockInvoke).toHaveBeenCalledWith('coach-chat', {
      body: { requestId: 'req-2', question: 'Follow-up?', payload: payload(), history },
    });
  });

  it('throws when the invoke call itself fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(askCoach('req-3', 'Q', payload())).rejects.toThrow('network down');
  });
});

describe('listCoachChatTurns', () => {
  it('maps server rows to CoachChatTurn, oldest-first for display', async () => {
    const rowOlder = { ...ROW, id: 'turn-older' };
    const rowNewer = { ...ROW, id: 'turn-newer' };
    // Server orders newest-first; the client reverses for top-to-bottom display.
    mockLimit.mockResolvedValue({ data: [rowNewer, rowOlder], error: null });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    const turns = await listCoachChatTurns(10);
    expect(mockFrom).toHaveBeenCalledWith('coach_chat_turns');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(turns.map((t) => t.id)).toEqual(['turn-older', 'turn-newer']);
    expect(turns[0]).toEqual({
      id: 'turn-older',
      question: 'Why did my target drop?',
      answer: 'Your trend stalled, so estimated burn dropped.',
      source: 'model',
      model: 'gpt-5-mini',
      generatedAt: '2026-07-15T09:00:00.000Z',
      payloadHash: 'abc123',
    });
  });
});
