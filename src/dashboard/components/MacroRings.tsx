import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Macros } from '../../engine';
import { isEmptyConsumption } from '../adapters';

/** Dashboard BRD §A5 — literal component signature. */
export interface MacroRingsProps {
  target: Macros;
  consumed: Macros;
}

const SIZE = 160;
const CENTER = SIZE / 2;

function kcalOf(m: Macros): number {
  return 4 * m.proteinG + 4 * m.carbG + 9 * m.fatG;
}

function Ring({ pct, color, radius, strokeWidth }: { pct: number; color: string; radius: number; strokeWidth: number }) {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <Circle
      cx={CENTER}
      cy={CENTER}
      r={radius}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={`${circumference * clamped} ${circumference}`}
      strokeLinecap="round"
      fill="none"
      transform={`rotate(-90 ${CENTER} ${CENTER})`}
    />
  );
}

const RING_COLOR = { protein: '#1a56db', carb: '#047857', fat: '#b45309' };
const EMPTY_COLOR = '#d4d4d8';
const EMPTY_TRACK = '#e5e5e5';

/**
 * Dashboard BRD §A2.2 — calories consumed vs Engine target, plus P/C/F
 * rings. kcal is derived here (4P+4C+9F), never stored — the Macros type
 * carries no kcal field, matching the project's "kcal always derived" rule.
 * Greys out cleanly (0% rings, dash for the number) rather than showing a
 * broken/NaN percentage when nothing's logged yet.
 */
export function MacroRings({ target, consumed }: MacroRingsProps) {
  const empty = isEmptyConsumption(consumed);
  const targetKcal = kcalOf(target);
  const consumedKcal = kcalOf(consumed);
  const kcalPct = empty || targetKcal <= 0 ? 0 : consumedKcal / targetKcal;

  const rings: { key: keyof typeof RING_COLOR; targetG: number; consumedG: number; radius: number }[] = [
    { key: 'protein', targetG: target.proteinG, consumedG: consumed.proteinG, radius: 60 },
    { key: 'carb', targetG: target.carbG, consumedG: consumed.carbG, radius: 48 },
    { key: 'fat', targetG: target.fatG, consumedG: consumed.fatG, radius: 36 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CENTER} cy={CENTER} r={72} stroke={EMPTY_TRACK} strokeWidth={10} fill="none" />
          <Ring pct={kcalPct} color={empty ? EMPTY_COLOR : '#111827'} radius={72} strokeWidth={10} />
          {rings.map((r) => (
            <Circle key={`${r.key}-track`} cx={CENTER} cy={CENTER} r={r.radius} stroke={EMPTY_TRACK} strokeWidth={8} fill="none" />
          ))}
          {rings.map((r) => (
            <Ring
              key={r.key}
              pct={empty || r.targetG <= 0 ? 0 : r.consumedG / r.targetG}
              color={empty ? EMPTY_COLOR : RING_COLOR[r.key]}
              radius={r.radius}
              strokeWidth={8}
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.kcalText}>{empty ? '—' : Math.round(consumedKcal)}</Text>
          <Text style={styles.kcalTarget}>/ {Math.round(targetKcal)} kcal</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: RING_COLOR.protein }]}>
          P {Math.round(consumed.proteinG)}/{Math.round(target.proteinG)}g
        </Text>
        <Text style={[styles.legendItem, { color: RING_COLOR.carb }]}>
          C {Math.round(consumed.carbG)}/{Math.round(target.carbG)}g
        </Text>
        <Text style={[styles.legendItem, { color: RING_COLOR.fat }]}>
          F {Math.round(consumed.fatG)}/{Math.round(target.fatG)}g
        </Text>
        <Text style={styles.legendItem}>
          Fiber {Math.round(consumed.fiberG)}/{Math.round(target.fiberG)}g
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  ringWrap: { width: SIZE, height: SIZE, position: 'relative' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalText: { fontSize: 22, fontWeight: '700' },
  kcalTarget: { fontSize: 12, color: '#666' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { fontSize: 12, fontWeight: '600' },
});
