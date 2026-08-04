import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccountsScreen } from './AccountsScreen';
import { BudgetScreen } from './BudgetScreen';
import { CashflowScreen } from './CashflowScreen';
import { DebtScreen } from './DebtScreen';
import { FinanceDataProvider, useFinanceData } from './FinanceDataContext';
import { ReportsScreen } from './ReportsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { AppButton, BottomTabBar, Dot, Row, type TabIconName } from '../kit';
import { space, type, useTheme } from '../theme';

export type FinanceTab = 'accounts' | 'cashflow' | 'transactions' | 'budget' | 'debt' | 'reports';

// Six tabs share the bar at flex:1 with an 11pt label, so labels stay short.
//
// Two slots were freed rather than added: fund goals live in the app-wide Goals
// module (src/ui/goals/), and the old Overview tab was a digest of the others —
// its account list duplicated Accounts and its recent list duplicated Log, so
// its net-worth and health cards moved to the top of Accounts.
const TABS: { key: FinanceTab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'accounts', label: 'Accounts', icon: 'accounts', title: 'Net worth' },
  { key: 'cashflow', label: 'Flow', icon: 'calendar', title: 'Cash flow' },
  { key: 'transactions', label: 'Log', icon: 'transactions', title: 'Transactions' },
  { key: 'budget', label: 'Budget', icon: 'budget', title: 'Budget' },
  { key: 'debt', label: 'Debt', icon: 'debt', title: 'Debt' },
  { key: 'reports', label: 'Reports', icon: 'reports', title: 'Reports' },
];

export function FinanceApp() {
  const [tab, setTab] = useState<FinanceTab>('accounts');

  return (
    <FinanceDataProvider>
      <FinanceAppBody tab={tab} onChangeTab={setTab} />
    </FinanceDataProvider>
  );
}

function FinanceAppBody({ tab, onChangeTab }: { tab: FinanceTab; onChangeTab: (tab: FinanceTab) => void }) {
  const t = useTheme();
  const router = useRouter();
  const { pendingOutboxCount } = useFinanceData();
  const active = TABS.find((x) => x.key === tab)!;

  return (
    <>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.title, { color: t.ink, flex: 1 }]}>{active.title}</Text>
        <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
      </View>

      {pendingOutboxCount > 0 && (
        <Row style={styles.syncBanner} gap={space.s}>
          <Dot color={t.warning} />
          <Text style={[type.caption, { color: t.muted }]}>
            {pendingOutboxCount} change{pendingOutboxCount === 1 ? '' : 's'} not yet synced
          </Text>
        </Row>
      )}

      <View style={styles.content}>
        {tab === 'cashflow' && <CashflowScreen />}
        {tab === 'transactions' && <TransactionsScreen />}
        {tab === 'accounts' && <AccountsScreen />}
        {tab === 'budget' && <BudgetScreen />}
        {tab === 'debt' && <DebtScreen onNavigateToAccounts={() => onChangeTab('accounts')} />}
        {tab === 'reports' && <ReportsScreen />}
      </View>

      <BottomTabBar tabs={TABS} active={tab} onChange={onChangeTab} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: space.m,
  },
  content: { flex: 1 },
  syncBanner: { paddingHorizontal: space.l, paddingBottom: space.s },
});
