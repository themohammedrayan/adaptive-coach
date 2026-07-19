import { supabase } from '../lib/supabase';
import type {
  Account,
  AccountType,
  AccountValuation,
  BalanceMode,
  Category,
  CategoryKind,
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

/* ------------------------------------------------------------ categories */

interface ServerCategoryRow {
  external_id: string;
  name: string;
  kind: CategoryKind;
  parent_external_id: string | null;
  is_system: boolean;
  color: string | null;
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

export async function softDeleteTransaction(externalId: string, deletedAtIso: string): Promise<void> {
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
