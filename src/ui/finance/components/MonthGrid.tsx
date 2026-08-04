import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IsoDate } from '../../../engine';
import type { ProjectedDay, ProjectedEvent } from '../../../finance/cashflow';
import { formatMoneyCompact } from '../../../finance/money';
import { monthGridDates } from '../../../finance/periods';
import { radius, space, type, useTheme, type Theme } from '../../theme';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** At one-seventh of the screen there is room for two chips before the cell stops being readable. */
const MAX_CHIPS_PER_DAY = 2;

export interface MonthGridProps {
  monthPrefix: string;
  days: ProjectedDay[];
  today: IsoDate;
  currency: string;
  selectedDate: IsoDate | null;
  onSelectDate: (date: IsoDate) => void;
}

function eventColor(t: Theme, event: ProjectedEvent): string {
  if (event.kind === 'settled') return t.muted;
  return event.deltaMinor >= 0 ? t.good : t.ink;
}

function EventChip({ event, currency }: { event: ProjectedEvent; currency: string }) {
  const t = useTheme();
  const settled = event.kind === 'settled';
  const recurring = event.recurrenceExternalId !== null;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: settled ? 'transparent' : t.wash,
          // A left rule marks a recurring series — the flat analogue of the
          // perforated ticket edge, with no SVG and no dashed-border quirks.
          borderLeftWidth: recurring ? 3 : 0,
          borderLeftColor: event.deltaMinor >= 0 ? t.good : t.danger,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          styles.chipText,
          {
            color: eventColor(t, event),
            // Settled events are struck through: they already happened.
            textDecorationLine: settled ? 'line-through' : 'none',
          },
        ]}
      >
        {event.label ?? formatMoneyCompact(event.deltaMinor, currency)}
      </Text>
    </View>
  );
}

function DayCell({
  day,
  today,
  currency,
  isSelected,
  showBalance,
  onPress,
}: {
  day: ProjectedDay;
  today: IsoDate;
  currency: string;
  isSelected: boolean;
  showBalance: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const isToday = day.date === today;
  const isPast = day.date < today;
  const overflow = day.events.length - MAX_CHIPS_PER_DAY;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${day.date}, balance ${formatMoneyCompact(day.closingBalanceMinor, currency)}`}
      style={({ pressed }) => [styles.cellOuter, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View
        style={[
          styles.cellInner,
          {
            borderColor: isSelected ? t.accent : t.hairline,
            borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
            backgroundColor: isToday ? t.accentSoft : 'transparent',
          },
        ]}
      >
        <View style={styles.cellHeader}>
          <Text
            style={[
              styles.dayNumber,
              { color: isToday ? t.accent : isPast ? t.muted : t.secondary, fontWeight: isToday ? '700' : '400' },
            ]}
          >
            {Number(day.date.slice(8, 10))}
          </Text>
          {day.netDeltaMinor !== 0 && (
            <Text
              numberOfLines={1}
              style={[styles.delta, { color: day.netDeltaMinor > 0 ? t.good : t.danger }]}
            >
              {formatMoneyCompact(day.netDeltaMinor, currency)}
            </Text>
          )}
        </View>

        {day.events.slice(0, MAX_CHIPS_PER_DAY).map((event) => (
          <EventChip key={event.key} event={event} currency={currency} />
        ))}
        {overflow > 0 && <Text style={[styles.more, { color: t.muted }]}>{`+${overflow}`}</Text>}

        <View style={styles.spacer} />

        {showBalance && (
          <View style={[styles.pill, { backgroundColor: t.wash }]}>
            <Text
              numberOfLines={1}
              style={[
                styles.pillText,
                { color: day.closingBalanceMinor < 0 ? t.danger : t.secondary },
              ]}
            >
              {formatMoneyCompact(day.closingBalanceMinor, currency)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * The month as a Monday-first 7-column grid: one cell per day carrying its net
 * delta, its events, and the projected running balance.
 *
 * Presentational only — every number arrives already computed by
 * `projectCashflow`.
 */
export function MonthGrid({
  monthPrefix,
  days,
  today,
  currency,
  selectedDate,
  onSelectDate,
}: MonthGridProps) {
  const t = useTheme();
  // The month owns the grid shape; the projection only fills it. If the two
  // ever disagree the cell renders blank rather than shifting every later day.
  const { leadingBlanks, dates } = monthGridDates(monthPrefix);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: (ProjectedDay | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...dates.map((date) => byDate.get(date) ?? null),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={[type.overline, { color: t.muted, fontSize: 10 }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) =>
          day === null ? (
            <View key={`blank-${index}`} style={styles.cellOuter} />
          ) : (
            <DayCell
              key={day.date}
              day={day}
              today={today}
              currency={currency}
              isSelected={day.date === selectedDate}
              // One balance per week keeps the running total scannable without
              // repeating a wide number in all seven columns.
              showBalance={index % 7 === 6 || index === cells.length - 1}
              onPress={() => onSelectDate(day.date)}
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekdayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingBottom: space.xs },
  cellOuter: { width: `${100 / 7}%`, padding: 1, minHeight: 82 },
  cellInner: { flex: 1, borderRadius: radius.control, padding: 3, gap: 2 },
  cellHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  dayNumber: { fontSize: 11 },
  delta: { fontSize: 8, flexShrink: 1 },
  chip: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  chipText: { fontSize: 8 },
  more: { fontSize: 8, paddingHorizontal: 2 },
  spacer: { flex: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 3, paddingVertical: 1, alignItems: 'center' },
  pillText: { fontSize: 8, fontWeight: '600' },
});
