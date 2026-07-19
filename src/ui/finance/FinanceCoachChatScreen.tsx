import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  askFinanceCoachQuestion,
  listFinanceCoachChatTurns,
  type FinanceChatHistoryTurn,
  type FinanceCoachChatTurn,
} from '../../finance-coach-chat';
import { AppButton, EmptyState, Field } from '../kit';
import { radius, space, type, useTheme, type Theme } from '../theme';
import { useFinanceData } from './FinanceDataContext';

/**
 * Reached via router.push('/finance-coach-chat') from the "Ask your finance
 * coach" card on the Finance Overview tab. Same shape as the health coach's
 * CoachChatScreen — a grounded answer, never a computed one — but reads
 * straight from FinanceDataContext instead of device stores/runtimes, since
 * Finance already loads everything into memory.
 */
export function FinanceCoachChatScreen() {
  const t = useTheme();
  const router = useRouter();
  const { accounts, transactions, valuations, goals, budgets, categories, today } = useFinanceData();
  const [turns, setTurns] = useState<FinanceCoachChatTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<FinanceCoachChatTurn>>(null);

  const load = useCallback(async () => {
    try {
      setTurns(await listFinanceCoachChatTurns());
      setError(null);
    } catch {
      setError("Couldn't load your chat history.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const trimmed = question.trim();
    if (trimmed === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const history: FinanceChatHistoryTurn[] = (turns ?? []).map((tn) => ({
        question: tn.question,
        answer: tn.answer,
      }));
      const turn = await askFinanceCoachQuestion(
        { accounts, transactions, valuations, goals, budgets, categories, today },
        trimmed,
        history,
      );
      setQuestion('');
      setTurns((prev) => [...(prev ?? []), turn]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError("Couldn't reach the coach. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.heading, { color: t.ink }]}>Finance coach</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          ref={listRef}
          data={turns ?? []}
          keyExtractor={(turn) => turn.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <TurnBubbles turn={item} t={t} />}
          ListEmptyComponent={
            <EmptyState message={error ?? 'Ask about your net worth, spending, budgets, or goal pace.'} />
          }
        />

        <View style={[styles.inputBar, { backgroundColor: t.card, borderTopColor: t.hairline }]}>
          <Field
            style={styles.flex}
            placeholder="Ask a question…"
            value={question}
            onChangeText={setQuestion}
            multiline
            editable={!busy}
          />
          <AppButton title="Send" onPress={send} busy={busy} disabled={question.trim() === ''} small />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TurnBubbles({ turn, t }: { turn: FinanceCoachChatTurn; t: Theme }) {
  return (
    <View style={styles.turn}>
      <View style={[styles.bubble, styles.questionBubble, { backgroundColor: t.accentSoft }]}>
        <Text style={[type.body, { color: t.ink }]}>{turn.question}</Text>
      </View>
      <View style={[styles.bubble, styles.answerBubble, { backgroundColor: t.wash }]}>
        <Text style={[type.body, { color: t.ink }]}>{turn.answer}</Text>
        {turn.source === 'fallback' && (
          <Text style={[type.caption, { color: t.muted, marginTop: 4 }]}>auto</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  headerSpacer: { width: 60 },
  list: { padding: space.l, paddingTop: space.s, gap: space.m, flexGrow: 1 },
  turn: { gap: space.s, marginBottom: space.m },
  bubble: { padding: space.m, borderRadius: radius.card, maxWidth: '90%' },
  questionBubble: { alignSelf: 'flex-end' },
  answerBubble: { alignSelf: 'flex-start' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.s,
    padding: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
