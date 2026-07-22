import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createFood, type Food, type Unit } from '../food-log';
import { getFoodLogRuntime } from '../food-log/runtime';
import { AppButton, Chip, Field, Row } from './kit';
import { space, type, useTheme } from './theme';

export interface CreateFoodFormInitialValues {
  name?: string;
  proteinPer100g?: number | null;
  carbPer100g?: number | null;
  fatPer100g?: number | null;
  fiberPer100g?: number | null;
  /** Present when macros aren't all known (kcal-only), same as manual entry's toggle. */
  kcalPer100g?: number | null;
}

function fieldString(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

/** Parses a required non-negative number field. Returns null for anything that isn't one, including empty. */
function parseNonNegNumber(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Food-Log BRD §2/§9 create-food form. Extracted out of FoodLogScreen so
 * both manual "create new food" and v2's AI meal-estimation review screen
 * share one implementation instead of two hand-maintained copies —
 * initialValues pre-fills the fields (e.g. from an AI estimate) but every
 * field stays user-editable before Save.
 */
export function CreateFoodForm({
  defaultUnitId,
  units,
  initialValues,
  onDone,
  onCancel,
}: {
  defaultUnitId: string;
  units: Unit[];
  initialValues?: CreateFoodFormInitialValues;
  onDone: (food: Food) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const iv = initialValues ?? {};
  const hasFullMacros = iv.proteinPer100g != null && iv.carbPer100g != null && iv.fatPer100g != null;
  const [name, setName] = useState(iv.name ?? '');
  const [kcalOnly, setKcalOnly] = useState(!hasFullMacros && iv.kcalPer100g !== undefined);
  const [protein, setProtein] = useState(fieldString(iv.proteinPer100g));
  const [carb, setCarb] = useState(fieldString(iv.carbPer100g));
  const [fat, setFat] = useState(fieldString(iv.fatPer100g));
  const [fiber, setFiber] = useState(fieldString(iv.fiberPer100g));
  const [kcal, setKcal] = useState(fieldString(iv.kcalPer100g));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (name.trim() === '') return setError('Enter a food name.');

    const fiberTrimmed = fiber.trim();
    const fiberN = fiberTrimmed === '' ? null : parseNonNegNumber(fiberTrimmed);
    if (fiberTrimmed !== '' && fiberN === null) return setError('Fiber must be a non-negative number.');

    let input: Parameters<typeof createFood>[1];
    if (kcalOnly) {
      const kcalN = parseNonNegNumber(kcal);
      if (kcalN === null) return setError('Enter calories per 100g.');
      input = {
        name: name.trim(),
        proteinPer100g: null,
        carbPer100g: null,
        fatPer100g: null,
        fiberPer100g: fiberN,
        kcalPer100g: kcalN,
        defaultUnitId,
      };
    } else {
      const proteinN = protein.trim() === '' ? 0 : parseNonNegNumber(protein);
      const carbN = carb.trim() === '' ? 0 : parseNonNegNumber(carb);
      const fatN = fat.trim() === '' ? 0 : parseNonNegNumber(fat);
      if (proteinN === null) return setError('Protein must be a non-negative number.');
      if (carbN === null) return setError('Carb must be a non-negative number.');
      if (fatN === null) return setError('Fat must be a non-negative number.');
      input = {
        name: name.trim(),
        proteinPer100g: proteinN,
        carbPer100g: carbN,
        fatPer100g: fatN,
        fiberPer100g: fiberN,
        defaultUnitId,
      };
    }

    setError(null);
    try {
      const rt = await getFoodLogRuntime();
      const food = await createFood(rt.store, input, rt.nowUtc());
      onDone(food);
      void rt.sync(true); // opportunistic push; offline is fine, outbox retries
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.sheetBody}>
      <Text style={[type.heading, { color: t.ink }]}>New food (per 100g)</Text>
      <Field label="Name" placeholder="Chicken curry" value={name} onChangeText={setName} />
      <Row>
        <Chip label="Full macros" active={!kcalOnly} onPress={() => setKcalOnly(false)} />
        <Chip label="kcal only" active={kcalOnly} onPress={() => setKcalOnly(true)} />
      </Row>
      {kcalOnly ? (
        <Field
          label="Calories per 100g"
          placeholder="240"
          keyboardType="decimal-pad"
          value={kcal}
          onChangeText={setKcal}
        />
      ) : (
        <Row gap={space.m}>
          <Field label="Protein g" placeholder="0" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} style={styles.flex} />
          <Field label="Carb g" placeholder="0" keyboardType="decimal-pad" value={carb} onChangeText={setCarb} style={styles.flex} />
          <Field label="Fat g" placeholder="0" keyboardType="decimal-pad" value={fat} onChangeText={setFat} style={styles.flex} />
        </Row>
      )}
      <Field label="Fiber g (optional)" placeholder="0" keyboardType="decimal-pad" value={fiber} onChangeText={setFiber} />
      {units.length > 0 && (
        <Text style={[type.caption, { color: t.muted }]}>
          Default unit: {units.find((u) => u.id === defaultUnitId)?.name}
        </Text>
      )}
      {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}
      <AppButton title="Save food" onPress={save} />
      <AppButton title="Cancel" onPress={onCancel} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheetBody: { padding: space.l, gap: space.m },
});
