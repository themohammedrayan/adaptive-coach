import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { timeToGoalLabel } from '../../goals/format';
import type { Goal, GoalProgress, GoalType } from '../../goals/types';
import { ProgressRing } from '../kit';
import { space, type, useTheme, type Theme } from '../theme';

const RING_SIZE = 60;

const TYPE_ICON: Record<GoalType, string> = {
  metric: '⚖️',
  fund: '💰',
  habit: '🔁',
  milestone: '🏁',
};

function ringColor(t: Theme, progress: GoalProgress | undefined): string {
  if (progress === undefined || progress.status === 'no_data') return t.muted;
  if (progress.status === 'completed') return t.good;
  if (progress.status === 'behind') return t.warning;
  if (progress.status === 'blocked') return t.muted;
  return t.accent;
}

/**
 * Every active goal as a ring, scrollable across the top of the list — the
 * shape of the whole portfolio at a glance, before the detail below.
 *
 * Blocked and no-data goals render dimmed rather than being hidden: a goal
 * waiting on something is still one you're carrying.
 */
export function GoalRingStrip({
  goals,
  progressByGoalId,
  today,
  selectedGoalId,
  onSelect,
}: {
  goals: Goal[];
  progressByGoalId: Map<string, GoalProgress>;
  today: string;
  selectedGoalId?: string | null;
  onSelect?: (goal: Goal) => void;
}) {
  const t = useTheme();
  if (goals.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {goals.map((goal) => {
        const progress = progressByGoalId.get(goal.id);
        const dimmed = progress === undefined || progress.status === 'no_data' || progress.status === 'blocked';
        const selected = selectedGoalId === goal.id;
        return (
          <Pressable
            key={goal.id}
            onPress={() => onSelect?.(goal)}
            accessibilityLabel={`${goal.title}, ${Math.round((progress?.pct ?? 0) * 100)}%`}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : dimmed ? 0.45 : 1 }]}
          >
            <ProgressRing
              size={RING_SIZE}
              strokeWidth={4}
              pct={progress?.pct ?? 0}
              color={ringColor(t, progress)}
              trackColor={selected ? t.accentSoft : t.wash}
            >
              <Text style={styles.icon}>{TYPE_ICON[goal.type]}</Text>
            </ProgressRing>
            <Text style={[type.caption, { color: t.muted }]} numberOfLines={1}>
              {timeToGoalLabel(goal.targetDate, today)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.m, paddingVertical: space.s, paddingHorizontal: space.xs },
  item: { alignItems: 'center', gap: 2, width: RING_SIZE + 8 },
  icon: { fontSize: 22 },
});
