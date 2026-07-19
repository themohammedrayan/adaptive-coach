import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccountsScreen } from './AccountsScreen';
import { FinanceDataProvider } from './FinanceDataContext';
import { FundGoalsScreen } from './FundGoalsScreen';
import { OverviewScreen } from './OverviewScreen';
import { ReportsScreen } from './ReportsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { BottomTabBar, type TabIconName } from '../kit';
import { space, type, useTheme } from '../theme';

export type FinanceTab = 'overview' | 'transactions' | 'accounts' | 'goals' | 'reports';

// Goals BRD §D.6/§G.7 — relabeled to "Fund Goals" now that "Goals" is the
// app-wide landing term (src/ui/goals/). Underlying logic unchanged.
const TABS: { key: FinanceTab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'overview', title: 'Net worth' },
  { key: 'transactions', label: 'Log', icon: 'transactions', title: 'Transactions' },
  { key: 'accounts', label: 'Accounts', icon: 'accounts', title: 'Accounts' },
  { key: 'goals', label: 'Fund Goals', icon: 'challenges', title: 'Fund Goals' },
  { key: 'reports', label: 'Reports', icon: 'reports', title: 'Reports' },
];

export function FinanceApp({ modeSwitcher }: { modeSwitcher?: ReactNode }) {
  const t = useTheme();
  const [tab, setTab] = useState<FinanceTab>('overview');
  const active = TABS.find((x) => x.key === tab)!;

  return (
    <FinanceDataProvider>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: t.ink }]}>{active.title}</Text>
        </View>
        {modeSwitcher}
      </View>

      <View style={styles.content}>
        {tab === 'overview' && <OverviewScreen />}
        {tab === 'transactions' && <TransactionsScreen />}
        {tab === 'accounts' && <AccountsScreen />}
        {tab === 'goals' && <FundGoalsScreen />}
        {tab === 'reports' && <ReportsScreen />}
      </View>

      <BottomTabBar tabs={TABS} active={tab} onChange={setTab} />
    </FinanceDataProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: space.m,
  },
  content: { flex: 1 },
});
