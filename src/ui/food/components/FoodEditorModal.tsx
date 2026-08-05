import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Food } from '../../../food-log';
import { AppButton, Card, Overline } from '../../kit';
import { space, type, useTheme } from '../../theme';
import { CreateFoodForm } from '../CreateFoodForm';
import { useFoodData } from '../FoodDataContext';

/**
 * Edit or hide a catalog food. `food: null` means the modal is closed — the same
 * `entity: Entity | null` idiom CategoryEditorModal uses.
 *
 * Two things here are consequences of the catalog being shared and append-only,
 * and both are stated in the UI rather than left implicit:
 *   - editing a food someone else contributed forks it instead of rewriting it,
 *     so their history keeps the numbers it was snapshotted from;
 *   - "remove" only hides it from this user's list. There is no delete, on
 *     purpose — the definition stays readable by everyone, forever.
 */
export function FoodEditorModal({
  visible,
  food,
  onClose,
}: {
  visible: boolean;
  food: Food | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const { units, myUserId, archiveFood } = useFoodData();

  if (food === null) return null;

  const isMine = food.createdBy === null || food.createdBy === myUserId;

  const confirmArchive = () => {
    Alert.alert(
      'Remove from your foods?',
      `${food.name} disappears from your list. It stays in the shared library, and your past entries keep the numbers they were logged with.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void archiveFood(food.id)
              .then(onClose)
              .catch((e: unknown) =>
                Alert.alert('Couldn’t remove', e instanceof Error ? e.message : String(e)),
              );
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={styles.card}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Overline>Edit food</Overline>
                {!isMine && (
                  <Text style={[type.caption, { color: t.muted, paddingHorizontal: space.l }]}>
                    Someone else added this food. Saving creates your own copy — theirs is left as it is.
                  </Text>
                )}
                <CreateFoodForm
                  food={food}
                  defaultUnitId={food.defaultUnitId}
                  units={units}
                  initialValues={{
                    name: food.name,
                    proteinPer100g: food.proteinPer100g,
                    carbPer100g: food.carbPer100g,
                    fatPer100g: food.fatPer100g,
                    fiberPer100g: food.fiberPer100g,
                    kcalPer100g: food.macrosComplete ? undefined : food.kcalPer100g,
                  }}
                  onDone={(_saved, forked) => {
                    onClose();
                    if (forked) {
                      Alert.alert(
                        'Saved as your copy',
                        'The original stays in the shared library for everyone who logged it.',
                      );
                    }
                  }}
                  onCancel={onClose}
                />
                <View style={styles.footer}>
                  <AppButton title="Remove from my foods" onPress={confirmArchive} variant="danger" small />
                </View>
              </ScrollView>
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
  card: { gap: space.m, maxHeight: '85%' },
  footer: { paddingHorizontal: space.l, paddingBottom: space.l },
});
