import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ResolvedBlock } from '../../calendar/types';
import { radius, space, type, useTheme } from '../theme';

const HOUR_HEIGHT = 44;
const DAY_HEIGHT = HOUR_HEIGHT * 24;
const GUTTER = 52;
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

function formatHour(hour: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
}

function formatClock(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const period = h < 12 ? 'am' : 'pm';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(mm).padStart(2, '0')}${period}`;
}

/**
 * Vertical single-day timeline — blocks positioned/sized proportionally to
 * their start/end minute. A block whose endMinute overflows past 1440 (an
 * overnight block, e.g. sleep 11pm-7am) is clipped to the visible day with a
 * small "continues tomorrow" marker, since it belongs to the day it starts.
 */
export function DayTimeline({
  blocks,
  onEditBlock,
}: {
  blocks: ResolvedBlock[];
  onEditBlock: (index: number) => void;
}) {
  const t = useTheme();

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: space.m, paddingHorizontal: space.l }}>
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

        <View style={{ flex: 1, position: 'relative' }}>
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

          {blocks.length === 0 && (
            <Text
              style={[
                type.body,
                {
                  color: t.muted,
                  textAlign: 'center',
                  position: 'absolute',
                  top: 12 * HOUR_HEIGHT,
                  left: 0,
                  right: 0,
                },
              ]}
            >
              No routine set for this day yet.
            </Text>
          )}

          {blocks.map((block, i) => {
            const top = (block.startMinute / 60) * HOUR_HEIGHT;
            const visibleEnd = Math.min(block.endMinute, 1440);
            const height = Math.max(((visibleEnd - block.startMinute) / 60) * HOUR_HEIGHT, 20);
            const overflowsToTomorrow = block.endMinute > 1440;
            const color = t.calendarCategory[block.category];
            return (
              <Pressable
                key={`${block.startMinute}-${i}`}
                onPress={() => onEditBlock(i)}
                style={({ pressed }) => [
                  styles.block,
                  { top, height, backgroundColor: color, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text numberOfLines={height < 32 ? 1 : 2} style={[type.caption, { color: '#FFFFFF', fontWeight: '700' }]}>
                  {block.label}
                </Text>
                {height >= 40 && (
                  <Text style={[type.caption, { color: '#FFFFFF', opacity: 0.85 }]}>
                    {formatClock(block.startMinute)} – {formatClock(block.endMinute)}
                    {overflowsToTomorrow ? ' ↓' : ''}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: space.xs,
    right: space.xs,
    borderRadius: radius.control - 4,
    paddingHorizontal: space.s,
    paddingVertical: 4,
    justifyContent: 'center',
  },
});
