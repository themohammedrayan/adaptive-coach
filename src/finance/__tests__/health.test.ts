import { assessFinancialHealth, type FinancialHealthInputs } from '../health';

function inputs(overrides: Partial<FinancialHealthInputs>): FinancialHealthInputs {
  return {
    savingsRatePct: null,
    netWorthTrendPct: null,
    overBudgetCount: 0,
    totalBudgetCount: 0,
    liabilitiesToAssetsRatio: null,
    maxCreditUtilizationPct: null,
    ...overrides,
  };
}

describe('assessFinancialHealth', () => {
  it('reads "good" for a healthy saver with rising net worth', () => {
    const result = assessFinancialHealth(
      inputs({ savingsRatePct: 25, netWorthTrendPct: 10, liabilitiesToAssetsRatio: 0.1, maxCreditUtilizationPct: 10 }),
    );
    expect(result.status).toBe('good');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('reads "concerning" when spending exceeds income and credit utilization is high', () => {
    const result = assessFinancialHealth(inputs({ savingsRatePct: -15, maxCreditUtilizationPct: 95 }));
    expect(result.status).toBe('concerning');
    expect(result.reasons.some((r) => r.includes('spending more than you earn'))).toBe(true);
  });

  it('reads "mixed" with no strong signals', () => {
    const result = assessFinancialHealth(inputs({ savingsRatePct: 5 }));
    expect(result.status).toBe('mixed');
  });

  it('falls back to a "not enough data" reason when nothing is measurable', () => {
    const result = assessFinancialHealth(inputs({}));
    expect(result.status).toBe('mixed');
    expect(result.reasons).toEqual(['Not enough data yet to read your finances — add accounts and log some transactions.']);
  });

  it('never surfaces more than 3 reasons', () => {
    const result = assessFinancialHealth(
      inputs({
        savingsRatePct: -20,
        netWorthTrendPct: -10,
        overBudgetCount: 3,
        totalBudgetCount: 4,
        liabilitiesToAssetsRatio: 0.9,
        maxCreditUtilizationPct: 90,
      }),
    );
    expect(result.reasons.length).toBeLessThanOrEqual(3);
  });
});
