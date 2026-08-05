import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CoachNotesFeed } from '../CoachNotesFeed';
import { FoodDataProvider } from '../food/FoodDataContext';
import { FoodLogScreen } from '../food/FoodLogScreen';
import { AppButton, BottomTabBar, type TabIconName } from '../kit';
import { MedicationsDataProvider } from '../medications/MedicationsDataContext';
import { MedicationsScreen } from '../medications/MedicationsScreen';
import { space, type, useTheme } from '../theme';
import { WeightScreen } from '../WeightScreen';

// Goals BRD §G.6 — the Challenges tab retired; metric-goal list/detail now
// lives in the Goals module (src/ui/goals/GoalDetailScreen.tsx's metric branch).
// The `home`/`profile` tabs retired when Dashboard/Profile became global outer
// tabs (see src/ui/AppShell.tsx) — Health is now reached by drilling in from
// the Dashboard tab and stays self-contained for its remaining sub-screens.
export type Tab = 'food' | 'weight' | 'medications' | 'coach';

const TABS: { key: Tab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'food', label: 'Food', icon: 'food', title: 'Food log' },
  { key: 'weight', label: 'Weight', icon: 'weight', title: 'Weight' },
  { key: 'medications', label: 'Meds', icon: 'medications', title: 'Medications' },
  { key: 'coach', label: 'Coach', icon: 'coach', title: 'Coach' },
];

export function HealthApp({ initialTab }: { initialTab?: Tab }) {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'food');

  const active = TABS.find((x) => x.key === tab)!;

  return (
    <>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.title, { color: t.ink, flex: 1 }]}>{active.title}</Text>
        <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
      </View>

      <View style={styles.content}>
        {tab === 'food' && (
          <FoodDataProvider>
            <FoodLogScreen />
          </FoodDataProvider>
        )}
        {tab === 'weight' && <WeightScreen />}
        {tab === 'medications' && (
          <MedicationsDataProvider>
            <MedicationsScreen />
          </MedicationsDataProvider>
        )}
        {tab === 'coach' && <CoachNotesFeed />}
      </View>

      <BottomTabBar tabs={TABS} active={tab} onChange={setTab} />
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
});
