import { StyleSheet, Text, View } from 'react-native';
import type { ResolvedMealItem, Unit } from '../../../food-log';
import { AppButton, Card, Chip, Field, Row } from '../../kit';
import { space, type, useTheme } from '../../theme';
import { FOOD_PHOTO_BUCKET } from '../FoodDataContext';
import { FoodPhoto } from './FoodPhoto';

/**
 * The editable state the review screen keeps per parsed item. `approved` only
 * gates `kind: 'new'` items — a matched item reuses a food the user already has,
 * so there is nothing to approve.
 */
export interface MealItemDraft {
  resolved: ResolvedMealItem;
  quantity: string;
  unitId: string;
  /** Only meaningful for new items; matched items are always included. */
  approved: boolean;
  /** Whether to log this item at all. */
  included: boolean;
  protein: string;
  carb: string;
  fat: string;
  fiber: string;
  kcal: string;
  name: string;
}

/**
 * One reviewable item from "tell the coach what you ate".
 *
 * Matched items are deliberately quiet — the food already exists, so all that's
 * left is the portion. New items carry a visible "new food" banner and stay out
 * of the log until explicitly approved; that per-item gate is what keeps a model
 * parse from silently adding foods and macros the user never saw.
 */
export function MealItemCard({
  draft,
  units,
  onChange,
}: {
  draft: MealItemDraft;
  units: Unit[];
  onChange: (next: MealItemDraft) => void;
}) {
  const t = useTheme();
  const isNew = draft.resolved.kind === 'new';
  const matchedFood = draft.resolved.kind === 'matched' ? draft.resolved.food : null;
  const kcalOnly = draft.protein.trim() === '' && draft.carb.trim() === '' && draft.fat.trim() === '';

  const set = (patch: Partial<MealItemDraft>) => onChange({ ...draft, ...patch });

  return (
    <Card style={[styles.card, !draft.included && styles.dimmed]}>
      <Row gap={space.m}>
        {matchedFood !== null && (
          <FoodPhoto
            bucket={FOOD_PHOTO_BUCKET}
            photoPath={matchedFood.photoPath}
            photoLocalUri={matchedFood.photoLocalUri}
            size={40}
          />
        )}
        <View style={styles.flex}>
          <Text style={[type.body, { color: t.ink, fontWeight: '600' }]}>{draft.name}</Text>
          {matchedFood !== null ? (
            <Text style={[type.caption, { color: t.good }]}>
              ✓ {matchedFood.name} — from your foods
            </Text>
          ) : (
            <Text style={[type.caption, { color: t.warning }]}>New food — approve to add</Text>
          )}
        </View>
        <Chip
          label={draft.included ? 'Logging' : 'Skipped'}
          active={draft.included}
          onPress={() => set({ included: !draft.included })}
        />
      </Row>

      {draft.resolved.confidence === 'low' && (
        <Text style={[type.caption, { color: t.muted }]}>
          The coach wasn’t confident about this one — worth a check.
        </Text>
      )}

      <Row gap={space.m}>
        <Field
          label="Quantity"
          keyboardType="decimal-pad"
          value={draft.quantity}
          onChangeText={(quantity) => set({ quantity })}
          style={styles.qty}
        />
        <View style={styles.flex}>
          <Text style={[type.caption, { color: t.secondary, fontWeight: '500', marginBottom: 6 }]}>Unit</Text>
          <Row style={styles.wrap} gap={6}>
            {units.map((u) => (
              <Chip
                key={u.id}
                label={u.name}
                active={draft.unitId === u.id}
                onPress={() => set({ unitId: u.id })}
              />
            ))}
          </Row>
        </View>
      </Row>

      {isNew && (
        <>
          <Field label="Name" value={draft.name} onChangeText={(name) => set({ name })} />
          {kcalOnly ? (
            <Field
              label="Calories per 100g"
              keyboardType="decimal-pad"
              value={draft.kcal}
              onChangeText={(kcal) => set({ kcal })}
            />
          ) : (
            <Row gap={space.m}>
              <Field
                label="Protein g"
                keyboardType="decimal-pad"
                value={draft.protein}
                onChangeText={(protein) => set({ protein })}
                style={styles.flex}
              />
              <Field
                label="Carb g"
                keyboardType="decimal-pad"
                value={draft.carb}
                onChangeText={(carb) => set({ carb })}
                style={styles.flex}
              />
              <Field
                label="Fat g"
                keyboardType="decimal-pad"
                value={draft.fat}
                onChangeText={(fat) => set({ fat })}
                style={styles.flex}
              />
            </Row>
          )}
          <Field
            label="Fiber g (optional)"
            keyboardType="decimal-pad"
            value={draft.fiber}
            onChangeText={(fiber) => set({ fiber })}
          />
          <AppButton
            title={draft.approved ? '✓ Approved — will be added' : 'Approve this new food'}
            onPress={() => set({ approved: !draft.approved })}
            variant={draft.approved ? 'secondary' : 'primary'}
            small
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.m },
  dimmed: { opacity: 0.5 },
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  qty: { width: 100 },
});
