import { supabase } from '../lib/supabase';
import type {
  Account,
  AccountType,
  AccountValuation,
  BalanceMode,
  Budget,
  Category,
  CategoryKind,
  FinanceGoal,
  FinanceGoalStatus,
  Iou,
  IouDirection,
  RecurrenceFrequency,
  RecurringTransaction,
  Transaction,
  TransactionType,
} from './types';

/* -------------------------------------------------------------- accounts */

interface ServerAccountRow {
  external_id: string;
  name: string;
  type: AccountType;
  balance_mode: BalanceMode;
  is_liability: boolean;
  currency: string;
  opening_balance_minor: number;
  opening_date: string | null;
  interest_rate: number | null;
  minimum_payment_minor: number | null;
  due_day: number | null;
  credit_limit_minor: number | null;
  source: 'manual' | 'imported';
  archived_at: string | null;
  updated_at?: string;
}

function accountToServer(a: Account) {
  return {
    external_id: a.externalId,
    name: a.name,
    type: a.type,
    balance_mode: a.balanceMode,
    is_liability: a.isLiability,
    currency: a.currency,
    opening_balance_minor: a.openingBalanceMinor,
    opening_date: a.openingDate,
    interest_rate: a.interestRate,
    minimum_payment_minor: a.minimumPaymentMinor,
    due_day: a.dueDay,
    credit_limit_minor: a.creditLimitMinor,
    source: a.source,
    archived_at: a.archivedAt,
  };
}

function accountFromServer(r: ServerAccountRow): Account {
  return {
    id: r.external_id,
    externalId: r.external_id,
    name: r.name,
    type: r.type,
    balanceMode: r.balance_mode,
    isLiability: r.is_liability,
    currency: r.currency,
    openingBalanceMinor: Number(r.opening_balance_minor),
    openingDate: r.opening_date,
    interestRate: r.interest_rate === null ? null : Number(r.interest_rate),
    minimumPaymentMinor: r.minimum_payment_minor === null ? null : Number(r.minimum_payment_minor),
    dueDay: r.due_day,
    creditLimitMinor: r.credit_limit_minor === null ? null : Number(r.credit_limit_minor),
    source: r.source,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('finance_accounts').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerAccountRow[]).map(accountFromServer);
}

export async function upsertAccount(account: Account): Promise<void> {
  const { error } = await supabase
    .from('finance_accounts')
    .upsert(accountToServer(account), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function archiveAccount(externalId: string, archivedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_accounts')
    .update({ archived_at: archivedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/** Symmetric to archiveAccount — restores a previously archived account back into view. */
export async function unarchiveAccount(externalId: string): Promise<void> {
  const { error } = await supabase
    .from('finance_accounts')
    .update({ archived_at: null })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/** Permanent delete — for accounts created by mistake. Prefer archiveAccount when history matters. */
export async function deleteAccount(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_accounts')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ categories */

interface ServerCategoryRow {
  external_id: string;
  name: string;
  kind: CategoryKind;
  parent_external_id: string | null;
  is_system: boolean;
  color: string | null;
  icon: string | null;
  updated_at?: string;
}

function categoryToServer(c: Category) {
  return {
    external_id: c.externalId,
    name: c.name,
    kind: c.kind,
    parent_external_id: c.parentExternalId,
    is_system: c.isSystem,
    color: c.color,
    icon: c.icon,
  };
}

function categoryFromServer(r: ServerCategoryRow): Category {
  return {
    id: r.external_id,
    externalId: r.external_id,
    name: r.name,
    kind: r.kind,
    parentExternalId: r.parent_external_id,
    isSystem: r.is_system,
    color: r.color,
    // Older rows predate the icon column; null just means "use the default".
    icon: r.icon ?? null,
    updatedAt: r.updated_at ?? '',
  };
}

/** Categories are seeded server-side (migration trigger on auth.users) — this only reads them. */
export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('finance_categories').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerCategoryRow[]).map(categoryFromServer);
}

export async function upsertCategory(category: Category): Promise<void> {
  const { error } = await supabase
    .from('finance_categories')
    .upsert(categoryToServer(category), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function archiveCategory(externalId: string, archivedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_categories')
    .update({ deleted_at: archivedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------- transactions */

interface ServerTransactionRow {
  external_id: string;
  type: TransactionType;
  account_external_id: string;
  counter_account_external_id: string | null;
  category_external_id: string | null;
  amount_minor: number;
  currency: string;
  note: string | null;
  txn_date: string;
  source: 'manual' | 'imported' | 'recurring';
  recurrence_external_id: string | null;
  updated_at?: string;
}

function transactionToServer(t: Transaction) {
  return {
    external_id: t.externalId,
    type: t.type,
    account_external_id: t.accountExternalId,
    counter_account_external_id: t.counterAccountExternalId,
    category_external_id: t.categoryExternalId,
    amount_minor: t.amountMinor,
    currency: t.currency,
    note: t.note,
    txn_date: t.txnDate,
    source: t.source,
    recurrence_external_id: t.recurrenceExternalId,
  };
}

function transactionFromServer(r: ServerTransactionRow): Transaction {
  return {
    id: r.external_id,
    externalId: r.external_id,
    type: r.type,
    accountExternalId: r.account_external_id,
    counterAccountExternalId: r.counter_account_external_id,
    categoryExternalId: r.category_external_id,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    note: r.note,
    txnDate: r.txn_date,
    source: r.source,
    recurrenceExternalId: r.recurrence_external_id,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('finance_transactions')
    .select('*')
    .is('deleted_at', null)
    .order('txn_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ServerTransactionRow[]).map(transactionFromServer);
}

export async function upsertTransaction(txn: Transaction): Promise<void> {
  const { error } = await supabase
    .from('finance_transactions')
    .upsert(transactionToServer(txn), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function deleteTransaction(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_transactions')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ valuations */

interface ServerValuationRow {
  external_id: string;
  account_external_id: string;
  amount_minor: number;
  as_of_date: string;
  source: 'manual' | 'imported';
  note: string | null;
  updated_at?: string;
}

function valuationToServer(v: AccountValuation) {
  return {
    external_id: v.externalId,
    account_external_id: v.accountExternalId,
    amount_minor: v.amountMinor,
    as_of_date: v.asOfDate,
    source: v.source,
    note: v.note,
  };
}

function valuationFromServer(r: ServerValuationRow): AccountValuation {
  return {
    id: r.external_id,
    externalId: r.external_id,
    accountExternalId: r.account_external_id,
    amountMinor: Number(r.amount_minor),
    asOfDate: r.as_of_date,
    source: r.source,
    note: r.note,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listValuations(): Promise<AccountValuation[]> {
  const { data, error } = await supabase.from('finance_valuations').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerValuationRow[]).map(valuationFromServer);
}

/** Upserts on (user_id, account_external_id, as_of_date) — re-entering the same day updates it. */
export async function upsertValuation(valuation: AccountValuation): Promise<void> {
  const { error } = await supabase
    .from('finance_valuations')
    .upsert(valuationToServer(valuation), { onConflict: 'user_id,account_external_id,as_of_date' });
  if (error) throw new Error(error.message);
}

export async function deleteValuation(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_valuations')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------- recurring transactions */

interface ServerRecurringTransactionRow {
  external_id: string;
  type: 'expense' | 'income' | 'transfer';
  account_external_id: string;
  counter_account_external_id: string | null;
  category_external_id: string | null;
  amount_minor: number;
  currency: string;
  note: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  last_materialized_date: string | null;
  active: boolean;
  updated_at?: string;
}

function recurringToServer(r: RecurringTransaction) {
  return {
    external_id: r.externalId,
    type: r.type,
    account_external_id: r.accountExternalId,
    counter_account_external_id: r.counterAccountExternalId,
    category_external_id: r.categoryExternalId,
    amount_minor: r.amountMinor,
    currency: r.currency,
    note: r.note,
    frequency: r.frequency,
    interval: r.interval,
    day_of_month: r.dayOfMonth,
    start_date: r.startDate,
    end_date: r.endDate,
    last_materialized_date: r.lastMaterializedDate,
    active: r.active,
  };
}

function recurringFromServer(r: ServerRecurringTransactionRow): RecurringTransaction {
  return {
    id: r.external_id,
    externalId: r.external_id,
    type: r.type,
    accountExternalId: r.account_external_id,
    counterAccountExternalId: r.counter_account_external_id,
    categoryExternalId: r.category_external_id,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    note: r.note,
    frequency: r.frequency,
    interval: r.interval,
    dayOfMonth: r.day_of_month,
    startDate: r.start_date,
    endDate: r.end_date,
    lastMaterializedDate: r.last_materialized_date,
    active: r.active,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listRecurringTransactions(): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase.from('finance_recurring_transactions').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerRecurringTransactionRow[]).map(recurringFromServer);
}

export async function upsertRecurringTransaction(rule: RecurringTransaction): Promise<void> {
  const { error } = await supabase
    .from('finance_recurring_transactions')
    .upsert(recurringToServer(rule), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function updateRecurringLastMaterializedDate(externalId: string, lastMaterializedDate: string): Promise<void> {
  const { error } = await supabase
    .from('finance_recurring_transactions')
    .update({ last_materialized_date: lastMaterializedDate })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringTransaction(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_recurring_transactions')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- goals */

interface ServerGoalRow {
  external_id: string;
  name: string;
  target_amount_minor: number;
  currency: string;
  linked_account_external_id: string;
  target_date: string | null;
  contribution_amount_minor: number | null;
  contribution_cadence: RecurrenceFrequency | null;
  contribution_flexible: boolean | null;
  status: FinanceGoalStatus;
  archived_at: string | null;
  updated_at?: string;
}

function goalToServer(g: FinanceGoal) {
  return {
    external_id: g.externalId,
    name: g.name,
    target_amount_minor: g.targetAmountMinor,
    currency: g.currency,
    linked_account_external_id: g.linkedAccountExternalId,
    target_date: g.targetDate,
    contribution_amount_minor: g.contributionAmountMinor,
    contribution_cadence: g.contributionCadence,
    contribution_flexible: g.contributionFlexible,
    status: g.status,
    archived_at: g.archivedAt,
  };
}

function goalFromServer(r: ServerGoalRow): FinanceGoal {
  return {
    id: r.external_id,
    externalId: r.external_id,
    name: r.name,
    targetAmountMinor: Number(r.target_amount_minor),
    currency: r.currency,
    linkedAccountExternalId: r.linked_account_external_id,
    targetDate: r.target_date,
    contributionAmountMinor:
      r.contribution_amount_minor === null || r.contribution_amount_minor === undefined
        ? null
        : Number(r.contribution_amount_minor),
    contributionCadence: r.contribution_cadence ?? null,
    // Rows predating the column read as flexible, matching the DB default.
    contributionFlexible: r.contribution_flexible ?? true,
    status: r.status,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listGoals(): Promise<FinanceGoal[]> {
  const { data, error } = await supabase.from('finance_goals').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerGoalRow[]).map(goalFromServer);
}

export async function upsertGoal(goal: FinanceGoal): Promise<void> {
  const { error } = await supabase
    .from('finance_goals')
    .upsert(goalToServer(goal), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function archiveGoal(externalId: string, archivedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_goals')
    .update({ status: 'archived', archived_at: archivedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- budgets */

interface ServerBudgetRow {
  external_id: string;
  category_external_id: string | null;
  amount_minor: number;
  currency: string;
  archived_at: string | null;
  updated_at?: string;
}

function budgetToServer(b: Budget) {
  return {
    external_id: b.externalId,
    category_external_id: b.categoryExternalId,
    amount_minor: b.amountMinor,
    currency: b.currency,
    archived_at: b.archivedAt,
  };
}

function budgetFromServer(r: ServerBudgetRow): Budget {
  return {
    id: r.external_id,
    externalId: r.external_id,
    categoryExternalId: r.category_external_id,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('finance_budgets').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerBudgetRow[]).map(budgetFromServer);
}

export async function upsertBudget(budget: Budget): Promise<void> {
  const { error } = await supabase
    .from('finance_budgets')
    .upsert(budgetToServer(budget), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function archiveBudget(externalId: string, archivedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_budgets')
    .update({ archived_at: archivedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- ious */

interface ServerIouRow {
  id: string;
  external_id: string;
  person_name: string;
  direction: IouDirection;
  amount_minor: number;
  currency: string;
  note: string | null;
  incurred_date: string;
  due_date: string | null;
  settled_at: string | null;
  updated_at: string | null;
}

function iouToServer(iou: Iou) {
  return {
    external_id: iou.externalId,
    person_name: iou.personName,
    direction: iou.direction,
    amount_minor: iou.amountMinor,
    currency: iou.currency,
    note: iou.note,
    incurred_date: iou.incurredDate,
    due_date: iou.dueDate,
    settled_at: iou.settledAt,
  };
}

function iouFromServer(r: ServerIouRow): Iou {
  return {
    id: r.id,
    externalId: r.external_id,
    personName: r.person_name,
    direction: r.direction,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    note: r.note,
    incurredDate: r.incurred_date,
    dueDate: r.due_date,
    settledAt: r.settled_at,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listIous(): Promise<Iou[]> {
  const { data, error } = await supabase.from('finance_ious').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerIouRow[]).map(iouFromServer);
}

export async function upsertIou(iou: Iou): Promise<void> {
  const { error } = await supabase
    .from('finance_ious')
    .upsert(iouToServer(iou), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function settleIou(externalId: string, settledAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('finance_ious')
    .update({ settled_at: settledAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}
