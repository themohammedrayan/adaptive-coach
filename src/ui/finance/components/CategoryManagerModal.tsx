import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { categoryAppearance } from '../../../finance/presetCategories';
import type { Category, CategoryKind } from '../../../finance/types';
import { AppButton, Card, EmptyState, Overline, Row } from '../../kit';
import { space, type, useTheme } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';
import { CategoryEditorModal } from './CategoryEditorModal';

const KIND_SECTIONS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Expense categories' },
  { value: 'income', label: 'Income categories' },
];

/** Reachable from TransactionsScreen's header — the standalone path to edit/create categories outside the add-transaction flow. */
export function CategoryManagerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { categories } = useFinanceData();
  const [editingKind, setEditingKind] = useState<CategoryKind>('expense');
  const [editingCategory, setEditingCategory] = useState<Category | null | undefined>(undefined);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m, maxHeight: '80%' }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Overline>Manage categories</Overline>
                <AppButton title="Done" onPress={onClose} variant="ghost" small />
              </Row>
              <ScrollView>
                {KIND_SECTIONS.map((section) => {
                  const rows = categories.filter((c) => c.kind === section.value);
                  return (
                    <View key={section.value} style={{ gap: space.s, marginBottom: space.m }}>
                      <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>{section.label}</Text>
                      {rows.length === 0 && <EmptyState message="No categories yet." />}
                      {rows.map((category) => {
                        const appearance = categoryAppearance(category.externalId, category.icon, category.color);
                        return (
                          <Pressable
                            key={category.id}
                            onPress={() => {
                              setEditingKind(category.kind);
                              setEditingCategory(category);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${category.name} category`}
                          >
                            <Row style={styles.row} gap={space.s}>
                              <Text style={styles.icon}>{appearance.icon}</Text>
                              <Text style={[type.body, { color: t.ink, flex: 1 }]}>{category.name}</Text>
                            </Row>
                          </Pressable>
                        );
                      })}
                      <AppButton
                        title={`New ${section.value} category`}
                        onPress={() => {
                          setEditingKind(section.value);
                          setEditingCategory(null);
                        }}
                        variant="secondary"
                        small
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <CategoryEditorModal
        visible={editingCategory !== undefined}
        onClose={() => setEditingCategory(undefined)}
        category={editingCategory ?? null}
        kind={editingKind}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
  row: { paddingVertical: space.xs },
  icon: { fontSize: 18 },
});
