import { useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { minuteToWheelPosition, wheelPositionToMinute, type WheelPosition } from '../../calendar/wheelTime';
import { radius, space, type, useTheme } from '../theme';
import { formatClock12h } from './timeInput';

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

/** Fully-controlled wheel picker: reports minutes-since-midnight (always a multiple of 5). */
export function WheelTimePicker({ minute, onChange }: { minute: number; onChange: (minute: number) => void }) {
  const t = useTheme();
  const pos = minuteToWheelPosition(minute);

  const update = (patch: Partial<WheelPosition>) => {
    onChange(wheelPositionToMinute({ ...pos, ...patch }));
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: t.accentSoft }]} />
      <WheelColumn items={HOURS} index={pos.hourIndex} onIndexChange={(hourIndex) => update({ hourIndex })} />
      <WheelColumn items={MINUTES} index={pos.minuteIndex} onIndexChange={(minuteIndex) => update({ minuteIndex })} />
      <WheelColumn
        items={PERIODS}
        index={pos.isPM ? 1 : 0}
        onIndexChange={(i) => update({ isPM: i === 1 })}
      />
    </View>
  );
}

function WheelColumn({
  items,
  index,
  onIndexChange,
}: {
  items: string[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const t = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const programmatic = useRef(false);

  useEffect(() => {
    programmatic.current = true;
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    // Clear on next tick — scrollTo(animated:false) resolves synchronously enough
    // for this guard to only suppress the scroll event it itself causes.
    const id = setTimeout(() => {
      programmatic.current = false;
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const handleSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (programmatic.current) return;
    const nextIndex = clampIndex(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), items.length);
    if (nextIndex !== index) onIndexChange(nextIndex);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.column}
      contentContainerStyle={{ paddingVertical: PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={handleSettle}
      onScrollEndDrag={handleSettle}
    >
      {items.map((label, i) => (
        <View key={label} style={styles.item}>
          <Text style={[type.body, { color: i === index ? t.ink : t.muted, fontWeight: i === index ? '700' : '400' }]}>
            {label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

/** Pressable box matching kit.tsx's Field look, showing a time and toggling the wheel below it. */
export function TimeFieldBox({
  label,
  minute,
  active,
  onPress,
}: {
  label: string;
  minute: number;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View style={fieldStyles.wrap}>
      <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          fieldStyles.box,
          {
            backgroundColor: t.dark ? t.wash : t.card,
            borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
            borderColor: active ? t.accent : t.hairline,
          },
        ]}
      >
        <Text style={[type.body, { color: t.ink }]}>{formatClock12h(minute)}</Text>
      </Pressable>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  box: { borderRadius: radius.control, paddingHorizontal: space.l, paddingVertical: 12 },
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    position: 'relative',
  },
  band: {
    position: 'absolute',
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2),
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: radius.control,
  },
  column: { flex: 1 },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
});
