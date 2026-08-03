import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccountsScreen } from './AccountsScreen';
import { CashflowScreen } from './CashflowScreen';
import { DebtScreen } from './DebtScreen';
import { FinanceDataProvider } from './FinanceDataContext';
import { OverviewScreen } from './OverviewScreen';
import { ReportsScreen } from './ReportsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { AppButton, BottomTabBar, type TabIconName } from '../kit';
import { space, type, useTheme } from '../theme';

export type FinanceTab = 'overview' | 'cashflow' | 'transactions' | 'accounts' | 'debt' | 'reports';

// Fund goals live in the app-wide Goals module (src/ui/goals/), which owns
// creating, listing and archiving them — Finance no longer mirrors them
// read-only, freeing this slot for Debt.
const TABS: { key: FinanceTab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'overview', title: 'Net worth' },
  // Label kept short: six tabs share the bar at flex:1 with an 11pt label.
  { key: 'cashflow', label: 'Flow', icon: 'calendar', title: 'Cash flow' },
  { key: 'transactions', label: 'Log', icon: 'transactions', title: 'Transactions' },
  { key: 'accounts', label: 'Accounts', icon: 'accounts', title: 'Accounts' },
  { key: 'debt', label: 'Debt', icon: 'debt', title: 'Debt' },
  { key: 'reports', label: 'Reports', icon: 'reports', title: 'Reports' },
];

export function FinanceApp() {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<FinanceTab>('overview');
  const active = TABS.find((x) => x.key === tab)!;

  return (
    <FinanceDataProvider>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.title, { color: t.ink, flex: 1 }]}>{active.title}</Text>
        <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
      </View>

      <View style={styles.content}>
        {tab === 'overview' && <OverviewScreen />}
        {tab === 'cashflow' && <CashflowScreen />}
        {tab === 'transactions' && <TransactionsScreen />}
        {tab === 'accounts' && <AccountsScreen />}
        {tab === 'debt' && <DebtScreen />}
        {tab === 'reports' && <ReportsScreen />}
      </View>

      <BottomTabBar tabs={TABS} active={tab} onChange={setTab} />
    </FinanceDataProvider>
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
});
