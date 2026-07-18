import { FunctionsHttpError } from '@supabase/supabase-js';

const mockInvoke = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

// Imported after the mock so remote.ts picks up the mocked module.
import { EstimateUnavailableError, estimateMeal } from '../remote';

const ESTIMATE = {
  name: 'Chicken curry',
  proteinPer100g: 15,
  carbPer100g: 8,
  fatPer100g: 10,
  fiberPer100g: 2,
  estimatedGrams: 350,
  confidence: 'medium' as const,
  kcalPer100g: 202,
  macrosComplete: true,
  source: 'model' as const,
  model: 'gpt-5-mini',
};

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('estimateMeal', () => {
  it('invokes the estimate-meal Edge Function and returns its estimate', async () => {
    mockInvoke.mockResolvedValue({ data: { estimate: ESTIMATE }, error: null });
    const estimate = await estimateMeal({ description: 'chicken curry, one bowl' });
    expect(mockInvoke).toHaveBeenCalledWith('estimate-meal', {
      body: { description: 'chicken curry, one bowl' },
    });
    expect(estimate).toEqual(ESTIMATE);
  });

  it('throws EstimateUnavailableError on a 422 estimate_unavailable response', async () => {
    const httpError = new FunctionsHttpError({
      json: async () => ({ error: 'estimate_unavailable' }),
    } as unknown as Response);
    mockInvoke.mockResolvedValue({ data: null, error: httpError });

    await expect(estimateMeal({ description: 'a blurry mystery dish' })).rejects.toBeInstanceOf(
      EstimateUnavailableError,
    );
  });

  it('rethrows other HTTP errors unchanged', async () => {
    const httpError = new FunctionsHttpError({
      json: async () => ({ error: 'unauthorized' }),
    } as unknown as Response);
    mockInvoke.mockResolvedValue({ data: null, error: httpError });

    await expect(estimateMeal({ description: 'x' })).rejects.toBe(httpError);
  });

  it('throws when the invoke call itself fails (transport error)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(estimateMeal({ description: 'x' })).rejects.toThrow('network down');
  });
});
