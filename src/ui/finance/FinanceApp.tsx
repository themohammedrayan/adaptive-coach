import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountsScreen } from './AccountsScreen';
import { FinanceDataProvider } from './FinanceDataContext';
import { OverviewScreen } from './OverviewScreen';
import { ReportsScreen } from './ReportsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { BottomTabBar, type TabIconName } from '../kit';
import { space, type, useTheme } from '../theme';

export type FinanceTab = 'overview' | 'transactions' | 'accounts' | 'reports';

const TABS: { key: FinanceTab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'overview', title: 'Net worth' },
  { key: 'transactions', label: 'Log', icon: 'transactions', title: 'Transactions' },
  { key: 'accounts', label: 'Accounts', icon: 'accounts', title: 'Accounts' },
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

      <ScrollView style={styles.content} contentContainerStyle={{ padding: space.l }}>
        {tab === 'overview' && <OverviewScreen />}
        {tab === 'transactions' && <TransactionsScreen />}
        {tab === 'accounts' && <AccountsScreen />}
        {tab === 'reports' && <ReportsScreen />}
      </ScrollView>

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
