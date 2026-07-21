import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CreateGoalScreen } from './CreateGoalScreen';
import { GoalDetailScreen } from './GoalDetailScreen';
import { GoalListScreen } from './GoalListScreen';
import { GoalsDataProvider } from './GoalsDataContext';
import { AppButton } from '../kit';
import { space, type, useTheme } from '../theme';

type Screen = { kind: 'list' } | { kind: 'create' } | { kind: 'detail'; goalId: string };

/**
 * Goals BRD §G — the app's landing surface. Local screen-state (list/create/
 * detail), not a bottom-tab pattern like Health/Finance — Goals has no
 * natural second top-level section to tab into (goal *type* is a filter
 * within the list, not a destination), so a persistent tab bar isn't
 * warranted here.
 */
export function GoalsApp({ modeSwitcher }: { modeSwitcher?: ReactNode }) {
  const t = useTheme();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });

  return (
    <GoalsDataProvider>
      {screen.kind === 'create' && <CreateGoalScreen onDone={() => setScreen({ kind: 'list' })} />}
      {screen.kind === 'detail' && (
        <GoalDetailScreen goalId={screen.goalId} onBack={() => setScreen({ kind: 'list' })} />
      )}
      {screen.kind === 'list' && (
        <>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: t.ink }]}>Goals</Text>
            </View>
            <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
            {modeSwitcher}
          </View>
          <View style={styles.content}>
            <GoalListScreen
              onSelectGoal={(goalId) => setScreen({ kind: 'detail', goalId })}
              onCreate={() => setScreen({ kind: 'create' })}
            />
          </View>
        </>
      )}
    </GoalsDataProvider>
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
