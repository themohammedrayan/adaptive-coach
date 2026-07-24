import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WEEKDAY_LABELS, type ResolvedBlock } from '../../calendar/types';
import { addDays, type IsoDate } from '../../engine';
import { space, type, useTheme } from '../theme';
import { CategoryLegend } from './CategoryLegend';
import { blockRect, DAY_HEIGHT, formatHour, GUTTER, HOUR_HEIGHT, HOUR_LABELS } from './timelineLayout';

/**
 * Read-only week-at-a-glance: 7 day columns, time running vertically, blocks
 * shown as color-only rects (columns are too narrow for label text). Tapping
 * anywhere in a column jumps to the detailed Day view for that date.
 */
export function WeekGridView({
  weekStartDate,
  today,
  resolveDay,
  onSelectDay,
}: {
  weekStartDate: IsoDate;
  today: IsoDate;
  resolveDay: (date: IsoDate) => ResolvedBlock[];
  onSelectDay: (date: IsoDate) => void;
}) {
  const t = useTheme();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  return (
    <View style={styles.flex}>
      <View style={styles.headerRow}>
        <View style={{ width: GUTTER }} />
        {dates.map((date, i) => {
          const isToday = date === today;
          return (
            <Pressable key={date} style={styles.headerCell} onPress={() => onSelectDay(date)}>
              <Text style={[type.caption, { color: isToday ? t.accent : t.muted }]}>{WEEKDAY_LABELS[i]}</Text>
              <View style={isToday ? [styles.dateBadge, { backgroundColor: t.accentSoft }] : undefined}>
                <Text
                  style={[
                    type.body,
                    { color: isToday ? t.accent : t.ink, fontWeight: isToday ? '700' : '500' },
                  ]}
                >
                  {Number(date.split('-')[2])}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.l, paddingBottom: space.m }}>
        <View style={{ height: DAY_HEIGHT, flexDirection: 'row' }}>
          <View style={{ width: GUTTER }}>
            {HOUR_LABELS.map((h) => (
              <Text
                key={h}
                style={[
                  type.caption,
                  {
                    color: t.muted,
                    position: 'absolute',
                    top: h * HOUR_HEIGHT - 7,
                    left: 0,
                    width: GUTTER - space.xs,
                    textAlign: 'right',
                  },
                ]}
              >
                {formatHour(h)}
              </Text>
            ))}
          </View>

          {dates.map((date) => (
            <Pressable key={date} style={styles.dayColumn} onPress={() => onSelectDay(date)}>
              {HOUR_LABELS.map((h) => (
                <View
                  key={h}
                  style={{
                    position: 'absolute',
                    top: h * HOUR_HEIGHT,
                    left: 0,
                    right: 0,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: t.chart.grid,
                  }}
                />
              ))}
              {resolveDay(date).map((block, i) => {
                const { top, height } = blockRect(block);
                return (
                  <View
                    key={`${block.startMinute}-${i}`}
                    style={{
                      position: 'absolute',
                      top,
                      height,
                      left: 2,
                      right: 2,
                      borderRadius: 3,
                      backgroundColor: t.calendarCategory[block.category],
                    }}
                  />
                );
              })}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <CategoryLegend />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', paddingHorizontal: space.l, paddingBottom: space.s },
  headerCell: { flex: 1, alignItems: 'center', gap: 2 },
  dateBadge: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999 },
  dayColumn: { flex: 1, position: 'relative' },
  legendRow: { paddingHorizontal: space.l, paddingVertical: space.s },
});
