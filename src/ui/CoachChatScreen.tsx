import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChallengeRuntime } from '../challenges/runtime';
import {
  askCoachQuestion,
  listCoachChatTurns,
  type AskCoachFinanceInputs,
  type AskCoachGoalsInputs,
  type ChatHistoryTurn,
  type CoachChatTurn,
} from '../coach-chat';
import { deviceLocalDate } from '../data-sync';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { getDashboardRuntime } from '../dashboard/runtime';
import type { IsoDate } from '../engine';
import * as financeApi from '../finance/api';
import { getFoodLogRuntime } from '../food-log/runtime';
import { loadResolvedGoals } from '../goals/loadResolvedGoals';
import { AppButton, EmptyState, Field } from './kit';
import { radius, space, type, useTheme, type Theme } from './theme';

const EMPTY_FINANCE: AskCoachFinanceInputs = {
  accounts: [],
  transactions: [],
  valuations: [],
  financeGoals: [],
  budgets: [],
  categories: [],
};

const EMPTY_GOALS: AskCoachGoalsInputs = { activeGoals: [], progressByGoalId: new Map() };

/**
 * Finance and Goals data both come from network fetches, unlike health's
 * local-store reads — a Finance API hiccup shouldn't break a coach answer
 * to a purely weight-related question. The unified payload already treats
 * empty finance/goals data as valid ("empty accounts just zeroes its
 * aggregates"), so a failed fetch degrades to that instead of failing the
 * whole chat turn.
 */
async function fetchFinanceForCoach(): Promise<{ data: AskCoachFinanceInputs; failed: boolean }> {
  try {
    const [accounts, transactions, valuations, financeGoals, budgets, categories] = await Promise.all([
      financeApi.listAccounts(),
      financeApi.listTransactions(),
      financeApi.listValuations(),
      financeApi.listGoals(),
      financeApi.listBudgets(),
      financeApi.listCategories(),
    ]);
    return { data: { accounts, transactions, valuations, financeGoals, budgets, categories }, failed: false };
  } catch {
    return { data: EMPTY_FINANCE, failed: true };
  }
}

async function fetchGoalsForCoach(today: IsoDate): Promise<{ data: AskCoachGoalsInputs; failed: boolean }> {
  try {
    const snapshot = await loadResolvedGoals(today);
    return {
      data: {
        activeGoals: snapshot.goals.filter((g) => g.status === 'active'),
        progressByGoalId: snapshot.progressByGoalId,
      },
      failed: false,
    };
  } catch {
    return { data: EMPTY_GOALS, failed: true };
  }
}

/**
 * Coach-unification — the single ad-hoc Q&A screen, reachable from any app
 * mode (Health's Coach tab, Finance's Overview, Goals home). Grounds a
 * question in whichever of health/finance/goals has data — never computes
 * anything new, just narrates cached/resolved state. Gathers everything it
 * needs itself (device runtimes, Finance's Supabase-direct reads, Goals'
 * resolved snapshot) rather than depending on FinanceDataContext/
 * GoalsDataProvider being mounted, since this route can be reached without
 * either.
 */
export function CoachChatScreen() {
  const t = useTheme();
  const router = useRouter();
  const [turns, setTurns] = useState<CoachChatTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [degraded, setDegraded] = useState(false);
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
      const [financeResult, goalsResult] = await Promise.all([
        fetchFinanceForCoach(),
        fetchGoalsForCoach(today),
      ]);
      setDegraded(financeResult.failed || goalsResult.failed);
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
          finance: financeResult.data,
          goals: goalsResult.data,
        },
        trimmed,
        today,
        history,
      );
      setQuestion('');
      setTurns((prev) => [...(prev ?? []), result.turn]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError("Couldn't reach the coach. Check your connection and try again.");
      setDegraded(false);
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
            <EmptyState message={error ?? 'Ask anything about your weight goal, finances, or other goals.'} />
          }
        />

        {degraded && (
          <Text style={[type.caption, { color: t.warning, paddingHorizontal: space.l, paddingBottom: space.xs }]}>
            Some data couldn't be loaded — this answer may be incomplete.
          </Text>
        )}

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
