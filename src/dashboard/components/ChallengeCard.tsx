import { StyleSheet, Text, View } from 'react-native';
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
  const pct =
    progress.percentComplete !== null ? Math.max(0, Math.min(1, progress.percentComplete)) : null;

  return (
    <View style={styles.container}>
      {pct !== null && (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>
      )}
      <Text style={styles.summary}>
        {Math.round(progress.bankedKcal)} / {Math.round(progress.totalBudgetKcal)} kcal banked
        {progress.percentComplete !== null ? ` (${Math.round(progress.percentComplete * 100)}%)` : ''}
      </Text>
      <Text style={styles.summary}>
        Day {progress.daysElapsed} of {progress.horizonDays} · {progress.daysRemaining} days left
      </Text>
      <Text style={[styles.pace, progress.onPace === false && styles.behind]}>{paceCopy(progress)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#e5e5e5', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#047857' },
  summary: { fontSize: 12, color: '#666' },
  pace: { fontSize: 12, fontWeight: '600' },
  behind: { color: '#b45309' },
});
