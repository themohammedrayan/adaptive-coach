import { Text, View } from 'react-native';
import type { BudgetProgress, UpcomingExpense } from '../../../finance/budget';
import { formatMoneyCompact, formatMoneyMinor } from '../../../finance/money';
import { categoryAppearance } from '../../../finance/presetCategories';
import type { Category } from '../../../finance/types';
import { ProgressBar, Row } from '../../kit';
import { radius, space, type, useTheme } from '../../theme';

/** One envelope: the category, what it's allowed, what it's used, and what's still coming. */
export function BudgetCategoryRow({
  progress,
  category,
  currency,
  upcoming,
}: {
  progress: BudgetProgress;
  category: Category | undefined;
  currency: string;
  upcoming: UpcomingExpense[];
}) {
  const t = useTheme();
  const appearance = categoryAppearance(
    progress.categoryExternalId ?? '',
    category?.icon ?? null,
    category?.color ?? null,
  );
  const tint = appearance.color ?? t.accent;
  const over = progress.pct > 1;

  return (
    <View style={{ gap: space.xs, paddingVertical: space.s }}>
      <Row gap={space.m}>
        <View style={[styles.tile, { backgroundColor: tint }]}>
          <Text style={styles.tileIcon}>{appearance.icon}</Text>
        </View>
        <Text style={[type.heading, { color: t.ink, flex: 1 }]} numberOfLines={1}>
          {category?.name ?? 'Overall'}
        </Text>
        <Text style={[type.body, { color: over ? t.danger : t.ink }]}>
          {formatMoneyMinor(progress.spentMinor, currency)}
          <Text style={[type.caption, { color: t.muted }]}> / {formatMoneyMinor(progress.budgetedMinor, currency)}</Text>
        </Text>
      </Row>

      <ProgressBar pct={progress.pct} color={over ? t.danger : tint} />

      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[type.caption, { color: t.muted }]}>
          {Math.round(progress.pct * 100)}% used · {formatMoneyMinor(progress.budgetedMinor, currency)} planned
        </Text>
        {upcoming.length > 0 && (
          <Row gap={space.xs}>
            {upcoming.slice(0, 3).map((u) => (
              <View key={u.key} style={[styles.chip, { backgroundColor: t.wash }]}>
                <Text style={[type.caption, { color: t.secondary }]}>
                  {u.icon} {u.daysAway === 0 ? 'today' : `${u.daysAway}d`}
                </Text>
              </View>
            ))}
            {upcoming.length > 3 && (
              <Text style={[type.caption, { color: t.muted }]}>+{upcoming.length - 3}</Text>
            )}
          </Row>
        )}
      </Row>

      {upcoming.length > 0 && (
        <Text style={[type.caption, { color: t.muted }]}>
          {formatMoneyCompact(
            upcoming.reduce((sum, u) => sum + u.amountMinor, 0),
            currency,
          )}{' '}
          still scheduled this period
        </Text>
      )}
    </View>
  );
}

const styles = {
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center' as const, justifyContent: 'center' as const },
  tileIcon: { fontSize: 18 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
};
