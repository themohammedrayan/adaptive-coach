import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../ui/kit';
import { type as typeScale, useTheme } from '../../ui/theme';
import type { ChallengeProgress } from '../challenge';

export interface ChallengeCardProps {
  progress: ChallengeProgress;
}

function paceCopy(progress: ChallengeProgress): string {
  if (progress.onPace === null) return "Trend is flat — see this week's note";
  if (progress.onPace) return 'On pace for the deadline';
  return `Behind pace — need ${Math.abs(progress.requiredWeeklyRateKg).toFixed(2)}kg/wk`;
}

/**
 * Dashboard follow-up — day-by-day framing for a fixed weight challenge
 * (e.g. "lose 20kg in 180 days"): kcal banked vs. the whole-challenge
 * budget, days elapsed/remaining, and pace vs. the deadline. Never a scary
 * countdown when stalled, matching projectedFinishCopy's tone elsewhere on
 * this screen.
 */
export function ChallengeCard({ progress }: ChallengeCardProps) {
  const t = useTheme();
  const pct =
    progress.percentComplete !== null ? Math.max(0, Math.min(1, progress.percentComplete)) : null;

  return (
    <View style={styles.container}>
      {pct !== null && <ProgressBar pct={pct} />}
      <Text style={[typeScale.caption, { color: t.secondary }]}>
        {Math.round(progress.bankedKcal)} / {Math.round(progress.totalBudgetKcal)} kcal banked
        {progress.percentComplete !== null ? ` (${Math.round(progress.percentComplete * 100)}%)` : ''}
      </Text>
      <Text style={[typeScale.caption, { color: t.secondary }]}>
        Day {progress.daysElapsed} of {progress.horizonDays} · {progress.daysRemaining} days left
      </Text>
      <Text
        style={[
          typeScale.caption,
          { fontWeight: '600', color: progress.onPace === false ? t.warning : t.ink },
        ]}
      >
        {paceCopy(progress)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
});
