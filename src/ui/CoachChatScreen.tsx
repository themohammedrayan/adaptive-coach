import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChallengeRuntime } from '../challenges/runtime';
import { askCoachQuestion, listCoachChatTurns, type ChatHistoryTurn, type CoachChatTurn } from '../coach-chat';
import { deviceLocalDate } from '../data-sync';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { getDashboardRuntime } from '../dashboard/runtime';
import { getFoodLogRuntime } from '../food-log/runtime';
import { AppButton, EmptyState, Field } from './kit';
import { radius, space, type, useTheme, type Theme } from './theme';

/**
 * v2 — ad-hoc coach Q&A. Reached via router.push('/coach-chat') from the
 * "Ask the coach a question" affordance on the Coach tab (CoachNotesFeed).
 * Unlike CoachNotesFeed, this asks a live question and gets a grounded
 * answer back — but the grounding itself still only narrates the cached
 * engine state, never computes anything new.
 */
export function CoachChatScreen() {
  const t = useTheme();
  const router = useRouter();
  const [turns, setTurns] = useState<CoachChatTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<CoachChatTurn>>(null);

  const load = useCallback(async () => {
    try {
      setTurns(await listCoachChatTurns());
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
      const [dashboardRt, foodLogRt, dataSyncRt, challengeRt] = await Promise.all([
        getDashboardRuntime(),
        getFoodLogRuntime(),
        getDataSyncRuntime(),
        getChallengeRuntime(),
      ]);
      const today = deviceLocalDate(new Date().toISOString());
      const history: ChatHistoryTurn[] = (turns ?? []).map((tn) => ({
        question: tn.question,
        answer: tn.answer,
      }));
      const result = await askCoachQuestion(
        {
          dashboardStore: dashboardRt.store,
          foodLogStore: foodLogRt.store,
          dataSyncStore: dataSyncRt.store,
          challengeStore: challengeRt.store,
        },
        trimmed,
        today,
        history,
      );
      if (result.status === 'no-data') {
        setNoData(true);
        return;
      }
      setQuestion('');
      setTurns((prev) => [...(prev ?? []), result.turn]);
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
        <Text style={[type.heading, { color: t.ink }]}>Ask the coach</Text>
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
            noData ? (
              <EmptyState message="Ask the coach anything — once your first weekly recompute has run, it can ground answers in your current target and trend." />
            ) : (
              <EmptyState message={error ?? 'Ask anything about your target, trend, or adherence.'} />
            )
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

function TurnBubbles({ turn, t }: { turn: CoachChatTurn; t: Theme }) {
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
