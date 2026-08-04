// Deno-side duplicate of src/finance/coachPayload.ts's types (this Edge
// Function is a separate deploy target and cannot import RN app source).
// Keep these two files in sync by hand — see src/finance/coachPayload.ts
// for the sibling copy. (Formerly mirrored src/finance-coach-chat/types.ts,
// retired by coach-unification.)

export type IsoDate = string;

export type FinancialHealthStatus = 'good' | 'mixed' | 'concerning';

export interface FinanceAccountSummary {
  name: string;
  type: string;
  balanceMinor: number;
  isLiability: boolean;
}

export interface FinanceGoalSummary {
  name: string;
  targetAmountMinor: number;
  savedMinor: number;
  targetDate: IsoDate | null;
}

export interface FinanceBudgetSummary {
  categoryName: string | null;
  budgetedMinor: number;
  spentMinor: number;
}

export interface FinanceHealthReadSummary {
  status: FinancialHealthStatus;
  reasons: string[];
}

export interface FinanceProjectionPoint {
  monthsAhead: number;
  projectedNetWorthMinor: number;
}

export type CashflowStatus = 'clear' | 'tight' | 'shortfall';

/** Mirrors CashflowOutlook in src/finance/cashflow.ts. */
export interface CashflowOutlook {
  status: CashflowStatus;
  lowBalanceMinor: number;
  lowDate: IsoDate;
  horizonDays: number;
}

export interface FinanceCoachPayload {
  today: IsoDate;
  currency: string;
  netWorthMinor: number;
  month: { incomeMinor: number; expenseMinor: number };
  topExpenseCategories: { categoryName: string; totalMinor: number }[];
  accounts: FinanceAccountSummary[];
  goals: FinanceGoalSummary[];
  budgets: FinanceBudgetSummary[];
  healthRead: FinanceHealthReadSummary;
  projection: FinanceProjectionPoint[];
  cashflow: CashflowOutlook;
}

export interface FinanceCoachChatTurn {
  id: string;
  question: string;
  answer: string;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
}
