import type { FinancialHealthStatus } from '../finance/health';
import type { IsoDate } from '../engine';

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
  /** Null = the overall monthly budget. */
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

/** Aggregates only, no raw transaction list — same "narrates, never computes" grounding contract as the health coach's CoachPayload. */
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

export interface FinanceChatHistoryTurn {
  question: string;
  answer: string;
}
