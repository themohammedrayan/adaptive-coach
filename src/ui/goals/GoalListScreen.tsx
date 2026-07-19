import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { diffDays } from '../../engine';
import type { Goal, GoalType } from '../../goals/types';
import { Card, EmptyState, FAB, ProgressBar, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useGoalsData } from './GoalsDataContext';

const TYPE_LABEL: Record<GoalType, string> = {
  metric: 'Metric',
  fund: 'Fund',
  habit: 'Habit',
  milestone: 'Milestone',
};

function typeColor(t: ReturnType<typeof useTheme>, type: GoalType): string {
  switch (type) {
    case 'metric':
      return t.chart.protein;
    case 'fund':
      return t.chart.carb;
    case 'habit':
      return t.chart.fat;
    case 'milestone':
      return t.accent;
  }
}

/** Goals BRD §G.5 — the landing view: every active goal, sortable, blocked rows locked. */
export function GoalListScreen({ onSelectGoal, onCreate }: { onSelectGoal: (goalId: string) => void; onCreate: () => void }) {
  const t = useTheme();
  const { goals, progressByGoalId, today } = useGoalsData();

  const active = goals
    .filter((g) => g.status === 'active')
    .slice()
    .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));

  const titleFor = (id: string | null) => (id === null ? null : (goals.find((g) => g.id === id)?.title ?? null));

  return (
    <View style={styles.flex}>
      <FlatList
        data={active}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState message="No goals yet — tap + to set one." />}
        renderItem={({ item }) => {
          const progress = progressByGoalId.get(item.id);
          const blocked = progress?.status === 'blocked';
          const overdue = item.targetDate !== null && diffDays(item.targetDate, today) < 0 && progress?.status !== 'completed';
          const pct = progress?.pct ?? null;
          return (
            <Pressable onPress={() => onSelectGoal(item.id)}>
              <Card style={styles.card}>
                <Row style={styles.header}>
                  <View style={[styles.badge, { backgroundColor: typeColor(t, item.type) }]}>
                    <Text style={styles.badgeText}>{TYPE_LABEL[item.type]}</Text>
                  </View>
                  {blocked && <Text style={[type.caption, { color: t.muted }]}>🔒 Locked</Text>}
                  {!blocked && overdue && <Text style={[type.caption, { color: t.warning }]}>Overdue</Text>}
                </Row>
                <Text style={[type.heading, { color: t.ink }]}>{item.title}</Text>
                {blocked ? (
                  <Text style={[type.caption, { color: t.muted }]}>
                    Blocked by {titleFor(item.blockedByGoalId) ?? 'another goal'}
                  </Text>
                ) : (
                  <>
                    {pct !== null && <ProgressBar pct={pct} color={progress?.status === 'completed' ? t.good : t.accent} />}
                    <Text style={[type.caption, { color: t.secondary }]}>
                      {pct !== null ? `${Math.round(pct * 100)}%` : 'No data yet'}
                      {progress?.status === 'behind' ? ' · behind' : ''}
                      {progress?.status === 'ahead' ? ' · ahead' : ''}
                    </Text>
                  </>
                )}
              </Card>
            </Pressable>
          );
        }}
      />
      <FAB icon="plus" accessibilityLabel="Create goal" onPress={onCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, paddingTop: space.s, gap: space.m },
  card: { gap: space.s, marginBottom: space.m },
  header: { justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
