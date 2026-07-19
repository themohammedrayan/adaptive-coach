/** Finance Reports — literal component signatures, shared by native + web variants. */
export interface CategoryBreakdownChartProps {
  data: { categoryName: string; totalMinor: number }[];
  currency: string;
}

export interface IncomeVsExpenseChartProps {
  data: { month: string; incomeMinor: number; expenseMinor: number }[];
  currency: string;
}

export interface NetWorthTrendChartProps {
  data: { date: string; netWorthMinor: number }[];
  currency: string;
}
