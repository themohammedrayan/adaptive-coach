import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ResolvedBlock } from '../../calendar/types';
import { radius, space, type, useTheme } from '../theme';
import { formatClock12h } from './timeInput';
import { blockRect, DAY_HEIGHT, formatHour, GUTTER, HOUR_HEIGHT, HOUR_LABELS } from './timelineLayout';

function nowMinuteOfDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
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
  isToday,
}: {
  blocks: ResolvedBlock[];
  onEditBlock: (index: number) => void;
  isToday: boolean;
}) {
  const t = useTheme();
  const [nowMinute, setNowMinute] = useState(nowMinuteOfDay);

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNowMinute(nowMinuteOfDay()), 60000);
    return () => clearInterval(id);
  }, [isToday]);

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
            const { top, height, overflowsToTomorrow } = blockRect(block);
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
                    {formatClock12h(block.startMinute)} – {formatClock12h(block.endMinute)}
                    {overflowsToTomorrow ? ' ↓' : ''}
                  </Text>
                )}
              </Pressable>
            );
          })}

          {isToday && (
            <View pointerEvents="none" style={{ position: 'absolute', top: (nowMinute / 60) * HOUR_HEIGHT - 1, left: 0, right: 0 }}>
              <View style={{ position: 'absolute', top: -4, left: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: t.danger }} />
              <View style={{ height: 2, backgroundColor: t.danger }} />
            </View>
          )}
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
