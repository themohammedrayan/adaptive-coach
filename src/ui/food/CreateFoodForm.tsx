import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inferDefaultUnitId, type CreateFoodInput, type Food, type FoodSource, type Unit } from '../../food-log';
import { AppButton, Chip, Field, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { FOOD_PHOTO_BUCKET, useFoodData, type PickedPhoto } from './FoodDataContext';
import { FoodPhoto } from './components/FoodPhoto';
import { useImagePick } from './useImagePick';

export interface CreateFoodFormInitialValues {
  name?: string;
  proteinPer100g?: number | null;
  carbPer100g?: number | null;
  fatPer100g?: number | null;
  fiberPer100g?: number | null;
  /** Present when macros aren't all known (kcal-only), same as manual entry's toggle. */
  kcalPer100g?: number | null;
  /** Provenance for a food the AI proposed; defaults to 'manual'. */
  source?: FoodSource;
  /** Photo already in hand — e.g. the plate the estimate was made from. */
  photo?: PickedPhoto | null;
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
 * Food-Log BRD §2/§9 create-food form — and the edit form too: `food: null`
 * means create, the same idiom the finance modals use. Manual entry, the AI
 * meal-estimation review and the food editor all share this one implementation
 * rather than three hand-maintained copies; `initialValues` pre-fills the fields
 * but every field stays user-editable before Save.
 *
 * Editing a catalog food someone else authored forks it rather than rewriting it
 * (see editFood), so `onDone` receives `forked` and the caller can say so.
 */
export function CreateFoodForm({
  food = null,
  defaultUnitId,
  units,
  initialValues,
  submitTitle,
  onDone,
  onCancel,
}: {
  /** null = create a new catalog food; otherwise edit (or fork) this one. */
  food?: Food | null;
  /**
   * Which unit to select *initially*. The user picks the final one below — this
   * used to be applied straight to the saved food with no way to change it,
   * which meant every food created here defaulted to grams.
   */
  defaultUnitId: string;
  units: Unit[];
  initialValues?: CreateFoodFormInitialValues;
  submitTitle?: string;
  onDone: (food: Food, forked: boolean) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const { saveFood } = useFoodData();
  const image = useImagePick();

  const iv = initialValues ?? {};
  const hasFullMacros = iv.proteinPer100g != null && iv.carbPer100g != null && iv.fatPer100g != null;
  const [name, setName] = useState(iv.name ?? '');
  const [kcalOnly, setKcalOnly] = useState(!hasFullMacros && iv.kcalPer100g !== undefined);
  const [protein, setProtein] = useState(fieldString(iv.proteinPer100g));
  const [carb, setCarb] = useState(fieldString(iv.carbPer100g));
  const [fat, setFat] = useState(fieldString(iv.fatPer100g));
  const [fiber, setFiber] = useState(fieldString(iv.fiberPer100g));
  const [kcal, setKcal] = useState(fieldString(iv.kcalPer100g));
  const [unitId, setUnitId] = useState(defaultUnitId);
  // Once the user picks a unit themselves, name-based inference stops fighting them.
  const [unitTouched, setUnitTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Suggest a unit from the name while creating: "Egg" → egg, "Milk" → ml.
  // Never on edit — an existing food's unit is the user's own earlier choice,
  // and re-inferring it would quietly change what their next log resolves to.
  const isCreate = food === null;
  useEffect(() => {
    if (!isCreate || unitTouched) return;
    setUnitId(inferDefaultUnitId(name, units));
  }, [name, units, isCreate, unitTouched]);

  const selectedUnit = units.find((u) => u.id === unitId) ?? null;

  // Seeded through an effect rather than useState so that a caller handing over
  // the estimate's photo doesn't clobber one the user picks afterwards.
  const seededPhoto = iv.photo ?? null;
  useEffect(() => {
    if (seededPhoto !== null) image.set(seededPhoto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededPhoto]);

  const save = async () => {
    if (name.trim() === '') return setError('Enter a food name.');

    const fiberTrimmed = fiber.trim();
    const fiberN = fiberTrimmed === '' ? null : parseNonNegNumber(fiberTrimmed);
    if (fiberTrimmed !== '' && fiberN === null) return setError('Fiber must be a non-negative number.');

    const source = iv.source ?? food?.source ?? 'manual';
    let input: CreateFoodInput;
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
        defaultUnitId: unitId,
        source,
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
        defaultUnitId: unitId,
        source,
      };
    }

    setError(null);
    setBusy(true);
    try {
      const result = await saveFood(food, input, image.photo);
      onDone(result.food, result.forked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const isEdit = food !== null;

  return (
    <View style={styles.sheetBody}>
      <Text style={[type.heading, { color: t.ink }]}>
        {isEdit ? 'Edit food (per 100g)' : 'New food (per 100g)'}
      </Text>

      <Row gap={space.m}>
        <FoodPhoto
          bucket={FOOD_PHOTO_BUCKET}
          photoPath={image.photo === null ? (food?.photoPath ?? null) : null}
          photoLocalUri={image.photo?.uri ?? food?.photoLocalUri ?? null}
          size={64}
        />
        <View style={styles.photoActions}>
          <Row gap={space.s}>
            <AppButton title="Photo" onPress={() => void image.pick('camera')} variant="secondary" small />
            <AppButton title="Choose" onPress={() => void image.pick('library')} variant="secondary" small />
          </Row>
          {image.photo !== null && (
            <AppButton title="Remove photo" onPress={image.clear} variant="ghost" small />
          )}
        </View>
      </Row>
      {image.error !== null && <Text style={[type.caption, { color: t.danger }]}>{image.error}</Text>}

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
        <View style={{ gap: 6 }}>
          <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>
            Default unit
          </Text>
          <Row style={styles.wrap} gap={6}>
            {units.map((u) => (
              <Chip
                key={u.id}
                label={u.name}
                active={unitId === u.id}
                onPress={() => {
                  setUnitTouched(true);
                  setUnitId(u.id);
                }}
              />
            ))}
          </Row>
          <Text style={[type.caption, { color: t.muted }]}>
            {selectedUnit === null
              ? 'Portions are logged in this unit.'
              : `Portions default to this — 1 ${selectedUnit.name} ≈ ${selectedUnit.defaultGrams} g. ` +
                'You can correct the grams per unit for this food when you log it.'}
          </Text>
        </View>
      )}
      {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}
      <AppButton title={submitTitle ?? (isEdit ? 'Save changes' : 'Save food')} onPress={save} busy={busy} />
      <AppButton title="Cancel" onPress={onCancel} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheetBody: { padding: space.l, gap: space.m },
  photoActions: { flex: 1, gap: space.s, justifyContent: 'center' },
  wrap: { flexWrap: 'wrap' },
});
