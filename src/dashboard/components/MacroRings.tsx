import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Macros } from '../../engine';
import { useTheme, type Theme } from '../../ui/theme';
import { isEmptyConsumption } from '../adapters';

/** Dashboard BRD §A5 — literal component signature. */
export interface MacroRingsProps {
  target: Macros;
  consumed: Macros;
}

const SIZE = 230;
const CENTER = SIZE / 2;
const KCAL_RADIUS = 104;
const KCAL_STROKE = 12;
const MACRO_STROKE = 9;

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

/**
 * Dashboard BRD §A2.2 — calories consumed vs Engine target, plus P/C/F
 * rings. kcal is derived here (4P+4C+9F), never stored — the Macros type
 * carries no kcal field, matching the project's "kcal always derived" rule.
 * Greys out cleanly (0% rings, dash for the number) rather than showing a
 * broken/NaN percentage when nothing's logged yet.
 */
export function MacroRings({ target, consumed }: MacroRingsProps) {
  const t = useTheme();
  const ringColor = { protein: t.chart.protein, carb: t.chart.carb, fat: t.chart.fat, fiber: t.muted };
  const empty = isEmptyConsumption(consumed);
  const targetKcal = kcalOf(target);
  const consumedKcal = kcalOf(consumed);
  const kcalPct = empty || targetKcal <= 0 ? 0 : consumedKcal / targetKcal;
  const over = !empty && targetKcal > 0 && consumedKcal > targetKcal;

  const rings: { key: keyof typeof ringColor; targetG: number; consumedG: number; radius: number }[] = [
    { key: 'protein', targetG: target.proteinG, consumedG: consumed.proteinG, radius: 88 },
    { key: 'carb', targetG: target.carbG, consumedG: consumed.carbG, radius: 74 },
    { key: 'fat', targetG: target.fatG, consumedG: consumed.fatG, radius: 60 },
    { key: 'fiber', targetG: target.fiberG, consumedG: consumed.fiberG, radius: 46 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CENTER} cy={CENTER} r={KCAL_RADIUS} stroke={t.chart.track} strokeWidth={KCAL_STROKE} fill="none" />
          <Ring
            pct={kcalPct}
            color={empty ? t.chart.track : over ? t.warning : t.chart.trend}
            radius={KCAL_RADIUS}
            strokeWidth={KCAL_STROKE}
          />
          {rings.map((r) => (
            <Circle key={`${r.key}-track`} cx={CENTER} cy={CENTER} r={r.radius} stroke={t.chart.track} strokeWidth={MACRO_STROKE} fill="none" />
          ))}
          {rings.map((r) => (
            <Ring
              key={r.key}
              pct={empty || r.targetG <= 0 ? 0 : r.consumedG / r.targetG}
              color={empty ? t.chart.track : ringColor[r.key]}
              radius={r.radius}
              strokeWidth={MACRO_STROKE}
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.kcalText, { color: over ? t.warning : t.ink }]}>{empty ? '—' : Math.round(consumedKcal)}</Text>
          <Text style={[styles.kcalTarget, { color: t.muted }]}>/ {Math.round(targetKcal)} kcal</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <LegendItem color={ringColor.protein} text={`P ${Math.round(consumed.proteinG)}/${Math.round(target.proteinG)}g`} t={t} />
        <LegendItem color={ringColor.carb} text={`C ${Math.round(consumed.carbG)}/${Math.round(target.carbG)}g`} t={t} />
        <LegendItem color={ringColor.fat} text={`F ${Math.round(consumed.fatG)}/${Math.round(target.fatG)}g`} t={t} />
        <LegendItem color={ringColor.fiber} text={`Fiber ${Math.round(consumed.fiberG)}/${Math.round(target.fiberG)}g`} t={t} />
      </View>
      {over && (
        <Text style={[styles.overText, { color: t.warning }]}>
          ⚠ {Math.round(consumedKcal - targetKcal)} kcal over target
        </Text>
      )}
    </View>
  );
}

/** Identity comes from the colored dot; the text stays in ink (dataviz rule). */
function LegendItem({ color, text, t }: { color: string; text: string; t: Theme }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: t.secondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
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
  kcalText: { fontSize: 26, fontWeight: '800' },
  kcalTarget: { fontSize: 12 },
  overText: { fontSize: 12, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '600' },
});
