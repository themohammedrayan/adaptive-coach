import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { defaultGenId } from '../../../finance/ids';
import { parseMoneyInput } from '../../../finance/money';
import type { Budget } from '../../../finance/types';
import { AppButton, Card, ErrorText, Field, Overline, Row } from '../../kit';
import { space } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';
import { showAlert } from '../../../lib/alert';

/**
 * One amount field per category plus an overall cap. Reuses an existing
 * budget's externalId when there is one, so the upsert resolves to an update;
 * a blank field means "no budget here", which is not an error.
 *
 * Moved out of ReportsScreen when budgets got their own screen.
 */
export function EditBudgetsModal({
  visible,
  onClose,
  budgets,
  categories,
  currency,
}: {
  visible: boolean;
  onClose: () => void;
  budgets: Budget[];
  categories: { externalId: string; name: string }[];
  currency: string;
}) {
  const { saveBudget, archiveBudget } = useFinanceData();
  const activeBudgets = useMemo(() => budgets.filter((b) => b.archivedAt === null), [budgets]);
  const findBudget = (categoryExternalId: string | null) =>
    activeBudgets.find((b) => b.categoryExternalId === categoryExternalId) ?? null;

  const [overallInput, setOverallInput] = useState(() => {
    const existing = findBudget(null);
    return existing !== null ? String(existing.amountMinor / 100) : '';
  });
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((c) => {
        const existing = findBudget(c.externalId);
        return [c.externalId, existing !== null ? String(existing.amountMinor / 100) : ''];
      }),
    ),
  );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const confirmRemove = (categoryExternalId: string | null, label: string) => {
    const existing = findBudget(categoryExternalId);
    if (existing === null) return;
    showAlert('Remove this budget?', `The "${label}" budget will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void archiveBudget(existing.externalId);
          if (categoryExternalId === null) setOverallInput('');
          else setCategoryInputs((prev) => ({ ...prev, [categoryExternalId]: '' }));
        },
      },
    ]);
  };

  const save = async () => {
    const nowIso = new Date().toISOString();
    const edits: { categoryExternalId: string | null; input: string; label: string }[] = [
      { categoryExternalId: null, input: overallInput, label: 'Overall' },
      ...categories.map((c) => ({ categoryExternalId: c.externalId, input: categoryInputs[c.externalId] ?? '', label: c.name })),
    ];
    const invalid: string[] = [];
    for (const edit of edits) {
      if (edit.input.trim() === '') continue; // blank means no budget for this row, not an error
      const amountMinor = parseMoneyInput(edit.input);
      if (amountMinor === null || amountMinor <= 0) {
        invalid.push(edit.label);
        continue;
      }
      const existing = findBudget(edit.categoryExternalId);
      await saveBudget({
        id: existing?.id ?? defaultGenId(),
        externalId: existing?.externalId ?? defaultGenId(),
        categoryExternalId: edit.categoryExternalId,
        amountMinor,
        currency,
        archivedAt: null,
        updatedAt: nowIso,
      });
    }
    if (invalid.length > 0) {
      setError(`Enter a valid positive amount for: ${invalid.join(', ')}.`);
      return;
    }
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <ScrollView>
              <Card style={{ gap: space.m }}>
                <Overline>Edit budgets</Overline>
                <Row gap={space.m} style={{ alignItems: 'flex-end' }}>
                  <Field
                    label="Overall monthly budget (optional)"
                    keyboardType="decimal-pad"
                    value={overallInput}
                    onChangeText={setOverallInput}
                    style={{ flex: 1 }}
                  />
                  {findBudget(null) !== null && (
                    <AppButton title="Remove" onPress={() => confirmRemove(null, 'Overall')} variant="ghost" small />
                  )}
                </Row>
                {categories.map((c) => (
                  <Row key={c.externalId} gap={space.m} style={{ alignItems: 'flex-end' }}>
                    <Field
                      label={c.name}
                      keyboardType="decimal-pad"
                      value={categoryInputs[c.externalId] ?? ''}
                      onChangeText={(v) => setCategoryInputs((prev) => ({ ...prev, [c.externalId]: v }))}
                      style={{ flex: 1 }}
                    />
                    {findBudget(c.externalId) !== null && (
                      <AppButton title="Remove" onPress={() => confirmRemove(c.externalId, c.name)} variant="ghost" small />
                    )}
                  </Row>
                ))}
                {error !== null && <ErrorText>{error}</ErrorText>}
                <AppButton title="Save budgets" onPress={save} />
              </Card>
            </ScrollView>
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
});
