import type { Granularity } from '../../../finance/periods';

/** Finance Reports — literal component signatures, shared by native + web variants. */
export interface CategoryBreakdownChartProps {
  /** `color` is the category's own colour when it has one; null falls back to the positional palette. */
  data: { categoryName: string; totalMinor: number; color: string | null }[];
  currency: string;
}

export interface IncomeVsExpenseChartProps {
  data: { month: string; incomeMinor: number; expenseMinor: number }[];
  currency: string;
  granularity: Granularity;
}

export interface NetWorthTrendChartProps {
  data: { date: string; netWorthMinor: number }[];
  currency: string;
  granularity: Granularity;
}

export interface ProjectedNetWorthChartProps {
  historical: { date: string; netWorthMinor: number }[];
  projection: { monthsAhead: number; projectedNetWorthMinor: number }[];
  currency: string;
}

export interface DebtPayoffChartProps {
  /** The plan for the strategy currently selected on screen — solid line. */
  plan: { month: number; totalBalanceMinor: number }[];
  planLabel: string;
  /** The opposite strategy, for comparison — dashed line. Absent when there's nothing to compare against. */
  otherPlan: { month: number; totalBalanceMinor: number }[] | null;
  otherPlanLabel: string;
  currency: string;
}
