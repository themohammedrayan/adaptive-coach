import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { defaultGenId } from '../../../finance/ids';
import {
  CATEGORY_COLOR_CHOICES,
  CATEGORY_ICON_CHOICES,
  categoryAppearance,
} from '../../../finance/presetCategories';
import type { Category, CategoryKind } from '../../../finance/types';
import { AppButton, Card, ErrorText, Field, Overline, Row } from '../../kit';
import { radius, space, type, useTheme } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';

/**
 * Creates or edits a category's name, emoji and colour.
 *
 * `category: null` means create. Editing reuses the existing externalId, so the
 * upsert resolves to an update — the same idiom EditBudgetsModal uses.
 */
export function CategoryEditorModal({
  visible,
  onClose,
  category,
  kind,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  category: Category | null;
  kind: CategoryKind;
  onSaved?: (category: Category) => void;
}) {
  const t = useTheme();
  const { saveCategory } = useFinanceData();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever the target changes, so reopening on a different category
  // doesn't show the previous one's values.
  useEffect(() => {
    if (!visible) return;
    const appearance = categoryAppearance(
      category?.externalId ?? '',
      category?.icon ?? null,
      category?.color ?? null,
    );
    setName(category?.name ?? '');
    setIcon(category === null ? null : appearance.icon);
    setColor(category?.color ?? appearance.color);
    setError(null);
  }, [visible, category]);

  const submit = async () => {
    setError(null);
    if (name.trim() === '') return setError('Give the category a name.');
    const nowIso = new Date().toISOString();
    const next: Category = {
      id: category?.id ?? defaultGenId(),
      externalId: category?.externalId ?? defaultGenId(),
      name: name.trim(),
      kind: category?.kind ?? kind,
      parentExternalId: category?.parentExternalId ?? null,
      isSystem: category?.isSystem ?? false,
      color,
      icon,
      updatedAt: nowIso,
    };
    try {
      await saveCategory(next);
      onSaved?.(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const preview = categoryAppearance(category?.externalId ?? '', icon, color);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>{category === null ? 'New category' : 'Edit category'}</Overline>

              <Row gap={space.m}>
                <View
                  style={[
                    styles.preview,
                    { backgroundColor: preview.color ?? t.wash, borderColor: t.hairline },
                  ]}
                >
                  <Text style={styles.previewIcon}>{preview.icon}</Text>
                </View>
                <Field
                  placeholder="Category name"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  style={{ flex: 1 }}
                />
              </Row>

              <Text style={[type.caption, { color: t.muted }]}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Row gap={space.xs}>
                  {CATEGORY_ICON_CHOICES.map((choice) => (
                    <Pressable
                      key={choice}
                      onPress={() => setIcon(choice)}
                      accessibilityRole="button"
                      accessibilityLabel={`Icon ${choice}`}
                      accessibilityState={{ selected: icon === choice }}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: t.wash,
                          borderColor: icon === choice ? t.accent : 'transparent',
                          borderWidth: icon === choice ? 2 : 2,
                        },
                      ]}
                    >
                      <Text style={styles.swatchIcon}>{choice}</Text>
                    </Pressable>
                  ))}
                </Row>
              </ScrollView>

              <Text style={[type.caption, { color: t.muted }]}>Colour</Text>
              <Row style={{ flexWrap: 'wrap' }} gap={space.xs}>
                {CATEGORY_COLOR_CHOICES.map((choice) => (
                  <Pressable
                    key={choice}
                    onPress={() => setColor(choice)}
                    accessibilityRole="button"
                    accessibilityLabel={`Colour ${choice}`}
                    accessibilityState={{ selected: color === choice }}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: choice, borderColor: color === choice ? t.ink : 'transparent' },
                    ]}
                  />
                ))}
              </Row>

              {error !== null && <ErrorText>{error}</ErrorText>}
              <AppButton title={category === null ? 'Add category' : 'Save category'} onPress={submit} />
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
  preview: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewIcon: { fontSize: 22 },
  swatch: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  swatchIcon: { fontSize: 20 },
  colorSwatch: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 2 },
});
