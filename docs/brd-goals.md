# Child BRD — Goals Module (v1)

Status: draft, not yet locked. Companion to the Master BRD and the five existing child
BRDs (Engine, Data-Sync, Food-Log, Dashboard+Reminders, Coaching). Written against the
codebase as of this branch; every file/function referenced below exists today unless
marked "(new)".

---

## §0 Conflicts with the original brief, resolved before this draft

The brief that requested this module assumed the app had no goal concept yet. That's
not true, and the gap changes the shape of this document:

1. **`src/challenges` already is the goal system for weight.** `WeightChallenge` carries
   `goalWeightKg` / `horizonDays` / `startWeightKg` / `isPrimary`, drives the engine's
   daily prescription, and already feeds `GoalSummary` into the coaching payload
   (`src/coaching/goal.ts`, cited as Coaching BRD §4). This BRD does not invent a
   `metric` goal type from scratch — it **absorbs** Challenge as that type's backing
   store. *(User-approved: absorb & rename, not wrap.)*
2. **Finance already has its own goal implementation** — `finance_goals` (Supabase
   table, migration `20260719130000_create_finance_goals.sql`) plus
   `financeGoalProgress()` in `src/finance/goals.ts`, which derives progress live from
   the linked account's balance and never stores a "saved so far" figure. This BRD's
   `fund` type wraps that, unchanged.
3. **`engine_state` no longer exists.** It was a real SQLite table once; a prior
   "Challenge rework" migrated its fields (`prevTargetKcal`, `lastRecomputeDate`) onto
   `WeightChallenge` rows and dropped the table. `metric` binds to the Challenge record,
   not to a table that isn't there anymore.
4. **There is no plugin/module registry in this codebase.** Every existing module is
   wired in by hand in the same places (see §B.2). "Adding a future module means adding
   a binding" is true at the *resolver* level; it is not true at the infrastructure
   level, and this document says so rather than implying otherwise.
5. **Metric-goal data is local-only SQLite, no Supabase sync.** *(User-approved: defer,
   not fix now.)* This is documented as an accepted v1 limitation (§I.6), not silently
   dropped.
6. **Navigation:** Goals becomes the app's landing surface, not a third peer tab next to
   Health and Finance. *(User-approved.)* §G defends this and states the tradeoff.

---

## §A Purpose & Scope

**A.1 Purpose.** A single cross-domain layer that lists, ranks, and narrates progress
toward a fixed set of real life goals — a muscular build, specific purchases, cleared
debt, reading, mechanical skill, shipped software, sharper thinking, a developed sense
of style — by reading progress from modules that already own the underlying data. It is
an aggregation and framing layer. **It is never the system of record for anything it
displays.**

**A.2 In scope for v1**
- A generic `goals` table + `source_binding` describing where each goal's progress comes
  from, and exactly one resolver per binding type.
- Absorbing `src/challenges` as the backing store for the `metric` type (vocabulary
  retired from user-facing UI; internal module can keep its file/folder names).
- A thin wrapper over the existing `finance_goals` / `financeGoalProgress()` for the
  `fund` type.
- Two brand-new tables (`habits`, `habit_log`) for the `habit` type — the only genuinely
  new data source this module needs.
- A new `goal_milestone_items` table for the `milestone` type.
- Single-predecessor blocking + numeric priority for goals that gate other goals.
- A Goals-home landing surface, replacing the current Health/Finance default.
- Extending the *existing* weekly coach note and the *existing* on-demand coach-chat
  surface with goal aggregates — never a new coaching call.

**A.3 Non-goals.** See §B.

---

## §B Non-Goals & Constraints

**B.1 Central invariant — reuse the finance module's own words.** From
`src/finance/goals.ts`: *"Progress is always read from the linked account's live
balance — a goal never stores its own 'saved so far' figure."* Generalize this across
all four types: **no resolver output is ever cached onto a `goals` row.** Every resolve
call recomputes from the source of truth. A `goals` row stores *what* to track and
*where* to look, never *how far along* it is.

**B.2 No plugin architecture — say so plainly.** Adding a fifth goal type in the future
still requires hand-touching four places, matching how every existing module in this
app was actually wired in:
1. `src/lib/resetAccount.ts` — append to the flat `RESET_REMOTE_TABLES` array and either
   add a field to the hardcoded `ResetStores` interface or a `clearLocalCaches`-style
   callback (Finance's pattern, since it has no full local store).
2. A new Supabase migration.
3. A new resolver function + a new `case` in `resolveGoalProgress`'s dispatch switch.
4. The hand-duplicated `CoachPayload` shape in `supabase/functions/_shared/types.ts`
   (Deno can't import RN source — Coaching already pays this tax; this module inherits
   it, doesn't introduce it).

"Adding a binding, not modifying the goals system" is true only of touch point 3. This
BRD does not claim otherwise.

**B.3 Engine stays pure.** Nothing in this module may add a goal-aware code to
`src/engine/types.ts`'s `Reason` union — that union belongs to Engine BRD and describes
engine-internal events only. Goal-narration signals get their own union, owned by
Coaching (§H.3).

**B.4 Metric data stays local-only in v1.** No new Supabase table for the folded-in
Challenge/engine bookkeeping. Documented limitation, not a gap discovered later (§I.6).

**B.5 Coach-note cadence is inherited, not redesigned.** Weekly coach-note generation
stays gated on Engine's own 7-day recompute interval in v1. A week where only Finance,
habit, or milestone goals moved (no weight recompute happened) will not get fresh
*weekly-note* narration until the next recompute — the on-demand chat surface (§H.7)
is the escape hatch for that gap, not a redesigned trigger.

---

## §C Goal Types & Resolver Contracts

**C.1 Common shape.**

```ts
type GoalType = 'metric' | 'fund' | 'habit' | 'milestone';
type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
type ProgressStatus =
  | 'on_track' | 'behind' | 'ahead' | 'blocked' | 'no_data' | 'completed';

interface Goal {
  id: string;
  externalId: string;
  type: GoalType;
  title: string;
  status: GoalStatus;
  priority: number;                 // lower = higher priority
  blockedByGoalId: string | null;   // single predecessor, v1 scope (§D.4)
  sourceBinding: SourceBinding;      // discriminated by .type, see §D.2
  targetDate: IsoDate | null;
  createdAt: string;
  updatedAt: string;
}

interface GoalProgress {
  pct: number | null;               // 0..1 clamped; null = no_data
  status: ProgressStatus;
  numerator: number | null;         // resolver-specific unit
  denominator: number | null;
  asOf: IsoDate;
  detail: Record<string, number | string | null>;  // feeds the coach allowlist, §H.4
}

type GoalResolver = (goal: Goal, ctx: ResolverContext) => Promise<GoalProgress>;
```

`ResolverContext` is a dependency-injected bundle of per-type store handles (mirrors the
`RefreshDeps` pattern already used in `src/dashboard/refreshSnapshot.ts`) — resolvers
never reach for a runtime singleton themselves, so each one is unit-testable against a
memory store exactly like the rest of this codebase's pure-calc modules.

**C.2 Dispatch.** `resolveGoalProgress(goal, ctx)` is the *entire* resolver seam:

```
function resolveGoalProgress(goal, ctx):
  switch goal.sourceBinding.type:
    case 'metric':    return resolveMetricGoal(goal, ctx)
    case 'fund':      return resolveFundGoal(goal, ctx)
    case 'habit':     return resolveHabitGoal(goal, ctx)
    case 'milestone': return resolveMilestoneGoal(goal, ctx)
```

Blocking and priority are **not** evaluated inside any resolver — they're a separate
pass over the resolved list (§D.4). Resolvers answer "how far along is this one goal,"
nothing about its relationship to other goals.

**C.3 metric** — binds to the absorbed Challenge record. `WeightChallenge` becomes the
metric goal type's engine-facing record. The "Challenge" name is retired from
user-facing UI and vocabulary; the `src/challenges/` package may keep its internal
file/folder names as an implementation detail (minimal-diff choice — a full package
rename is a nice-to-have, not required for v1).

**C.4 fund** — a thin wrapper over the already-built `financeGoalProgress()`
(`src/finance/goals.ts`). No changes to the `finance_goals` schema or its progress
derivation.

**C.5 habit** — backed by two new tables (§F). The only type needing genuinely new
data.

**C.6 milestone** — backed by one new table (`goal_milestone_items`), no external
module involved.

**C.7 Type comparison table**

| Type      | Source module        | Binding carries         | "Done" means                  | Has deadline | Participates in blocking (v1) | Has engine-driving primary |
|-----------|-----------------------|--------------------------|--------------------------------|:---:|:---:|:---:|
| metric    | `src/challenges`       | local Challenge id       | trend reaches goal weight       | yes | no | yes (metric-internal) |
| fund      | `src/finance`          | finance goal external id | balance ≥ target amount         | yes (optional) | yes | no |
| habit     | new `habits`/`habit_log` | habit external id      | rolling window meets frequency  | no (recurring) | no | no |
| milestone | new `goal_milestone_items` | — (self-hosted)     | all checklist items checked     | yes (optional) | no | no |

---

## §D Data Model

**D.1 `goals` table.** Follows the convention used by every existing user table in this
app (`finance_goals`'s migration is the literal template: `id`/`user_id`/`external_id`
dedupe, soft delete, `set_updated_at()` trigger, RLS on `user_id = auth.uid()`).

```sql
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  type text not null check (type in ('metric','fund','habit','milestone')),
  title text not null,
  status text not null default 'active'
    check (status in ('active','paused','completed','archived')),
  priority integer not null default 0,
  blocked_by_goal_id uuid references public.goals(id),
  source_binding jsonb not null,
  target_date date,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);
-- set_updated_at trigger + 4 RLS policies (own-row select/insert/update/delete),
-- identical pattern to finance_goals.
```

**D.2 `source_binding` shapes** (jsonb, discriminated by its own `type` field):

```ts
type SourceBinding =
  | { type: 'metric'; challengeId: string }              // local SQLite id — NOT a Supabase FK
  | { type: 'fund'; financeGoalExternalId: string }       // loose external_id ref
  | { type: 'habit'; habitExternalId: string }            // loose external_id ref
  | { type: 'milestone' };                                 // empty — items keyed by goal.externalId
```

The `metric` binding pointing at a *local* id rather than a Supabase foreign key is
deliberate — it's the concrete, testable expression of "defer sync" (§I.6): a `goals`
row can be synced across devices while the thing it points to cannot yet be.

**D.3 Relationships (prose).**
- `goals` ← `goal_milestone_items` (milestone only, real FK by `goal_id`).
- `goals.source_binding.habitExternalId` → `habits` → `habit_log` (loose, no FK,
  consistent with how Finance already cross-references entities by `external_id`).
- `goals.source_binding.financeGoalExternalId` → `finance_goals` (loose, no FK,
  `finance_goals` untouched).
- `goals.source_binding.challengeId` → local-only SQLite `challenges` table (no Supabase
  relation is possible while metric data stays unsynced).

**D.4 Blocking & priority.** Evaluated in one separate pass over the whole resolved
list, after every resolver has run — never inside a resolver:

```
function applyBlocking(goals, progressByGoalId):
  for g in goals:
    if g.blockedByGoalId is not null:
      predecessor = progressByGoalId[g.blockedByGoalId]
      if predecessor.status != 'completed':
        progressByGoalId[g.id].status = 'blocked'
  return progressByGoalId
```

V1 scope is a **single predecessor** per goal (a chain, not a graph). Many-to-many /
AND-gated blocking is deferred (§J.2, future `goal_blocks` join table).

`isPrimary` (metric-only, lives inside the Challenge record, means "drives the engine's
prescription") and `priority`/`blocked_by_goal_id` (generic, fund-oriented in practice,
means "gates other goals") are **two unrelated concepts that share a word
colloquially.** Keep them lexically separate in the schema — `isPrimary` is never
promoted onto `goals`.

**D.5 Migration plan.** One new migration creates `goals`, `habits`, `habit_log`,
`goal_milestone_items` together, following `finance_goals`'s migration as the literal
template for columns/RLS/trigger. No changes to `finance_goals` or the Challenge SQLite
schema. `src/lib/resetAccount.ts`'s `RESET_REMOTE_TABLES` gains the four new table
names; the local Challenge clear already covers metric's local data, no change needed
there.

**D.6 Required rename.** `src/ui/finance/GoalsScreen.tsx` (Finance's existing "Goals"
tab) must be relabeled — e.g. "Fund Goals" or "Savings" — once "Goals" becomes the
app-wide landing term. Underlying screen logic is unchanged; this is a naming
disambiguation, not a rewrite.

---

## §E Progress-Calc Pseudocode Per Resolver

**E.1 metric**

```
function resolveMetricGoal(goal, ctx):
  challenge = ctx.challengeStore.getById(goal.sourceBinding.challengeId)
  if challenge is null or challenge.status == 'deleted':
    return { pct: null, status: 'no_data', numerator: null, denominator: null,
             asOf: today, detail: { sourceMissing: true } }

  trendKg = computeTrend(ctx.measurements, today)          // reuse, don't reimplement
  pct = clamp01(
    (challenge.startWeightKg - trendKg) /
    (challenge.startWeightKg - challenge.goalWeightKg)
  )                                                          // mode-aware for 'gain'
  lastResult = ctx.lastEngineResult(challenge)
  status =
    lastResult.boundHit == 'none' ? 'on_track' :
    lastResult.boundHit == 'insufficientData' ? 'no_data' : 'behind'
  return {
    pct, status,
    numerator: trendKg, denominator: challenge.goalWeightKg,
    asOf: today,
    detail: { trendKg, daysElapsed, projectedFinishDate: lastResult.projectedFinishDate }
  }
```

**E.2 fund**

```
function resolveFundGoal(goal, ctx):
  financeGoal = ctx.financeGoalStore.getByExternalId(goal.sourceBinding.financeGoalExternalId)
  if financeGoal is null: return noData()

  balance = accountBalanceAsOf(financeGoal.linkedAccountExternalId, today)
  { pct, savedMinor, remainingMinor } = financeGoalProgress(financeGoal, balance)  // existing fn, unchanged

  status = 'on_track'
  if goal.targetDate:
    expected = expectedPctByNow(goal.createdAt, goal.targetDate, today)   // shared helper, §E.5
    status = pct < expected - EPSILON ? 'behind' : (pct > expected + EPSILON ? 'ahead' : 'on_track')
  if pct >= 1: status = 'completed'

  return { pct, status, numerator: savedMinor, denominator: financeGoal.targetAmountMinor,
           asOf: today, detail: { remainingMinor } }
  // blocking is applied afterward by applyBlocking(), not here
```

**E.3 habit**

```
function resolveHabitGoal(goal, ctx):
  habit = ctx.habitStore.getByExternalId(goal.sourceBinding.habitExternalId)
  if habit is null: return noData()

  windowStart = today - habit.windowDays
  count = ctx.habitLogStore.countInRange(habit.externalId, windowStart, today)
  pct = clamp01(count / habit.targetCount)

  status = 'on_track'
  expected = expectedPctByNow(windowStart, today, today, habit.windowDays)  // shared helper
  if pct < expected - EPSILON: status = 'behind'
  if pct >= 1: status = 'completed'

  return { pct, status, numerator: count, denominator: habit.targetCount,
           asOf: today, detail: { windowDays: habit.windowDays } }
```

**E.4 milestone**

```
function resolveMilestoneGoal(goal, ctx):
  items = ctx.milestoneItemStore.listByGoal(goal.externalId)   // excludes soft-deleted
  if items.length == 0: return noData()

  done = items.filter(i => i.checkedAt != null).length
  pct = done / items.length
  status = pct >= 1 ? 'completed' : 'on_track'
  if goal.targetDate and status != 'completed':
    expected = expectedPctByNow(goal.createdAt, goal.targetDate, today)
    if pct < expected - EPSILON: status = 'behind'

  return { pct, status, numerator: done, denominator: items.length,
           asOf: today, detail: {} }
```

**E.5 Shared helper.** fund, habit, and milestone all use one
`expectedPctByNow(start, end, asOf)` elapsed-fraction helper — implement once, don't
copy-paste three times. `metric` is the only resolver with a genuinely different status
heuristic, because it defers to Engine's own `boundHit` rather than a naive elapsed-time
fraction (Engine BRD's clamp philosophy — safe rate is the hard constraint, the deadline
is soft — must not be re-derived here).

---

## §F Habit Log — the one new data source

**F.1 `habits` table**

```sql
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  name text not null,
  cadence_kind text not null default 'count_per_window'
    check (cadence_kind in ('count_per_window')),   -- v1: exactly one cadence style
  target_count integer not null,
  window_days integer not null,
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);
```

**F.2 `habit_log` table**

```sql
create table public.habit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  external_id text not null,
  habit_external_id text not null,        -- loose reference, no FK — matches Finance's style
  occurred_on date not null,
  note text,
  source text not null default 'manual' check (source in ('manual')),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, habit_external_id, occurred_on)   -- at most one check-in per habit per day
);
```

The uniqueness constraint mirrors Data-Sync's `body_metrics` precedent ("guarantees at
most one per day") — same reasoning applies here.

**F.3 UX.** No new tab, no separate habit-tracking sub-app. A habit-type Goal Detail
screen shows: a "Did you do this today?" toggle, and a trailing `window_days`-long
calendar strip of filled/empty dots for the rolling window. That's the entire entry
surface for v1.

**F.4 Sync contrast, stated explicitly.** Unlike `metric` (deferred sync, §B.4, §I.6),
`habit` is Supabase-synced from day one — it has no legacy local-only debt to inherit.
Called out here so the difference reads as a deliberate contrast, not an
inconsistency.

---

## §G Dashboard / UI Surfaces & the Navigation Decision

**G.1 The decision.** Goals becomes the app's **landing surface**. The existing
Health/Finance icon-tile switcher (`ModeSwitcher`) is demoted to "drill into a domain,"
reached *from* Goals home, not the reverse.

**G.2 Why, and the alternative rejected.** The brief's own framing is that goals are the
actual point of this app; Health and Finance are just its two current data sources. A
third peer tile next to Health/Finance in `ModeSwitcher` would have been a smaller
diff, but it visually demotes goals to equal footing with its own inputs — backwards
from the app's real purpose. The larger rework is accepted deliberately.

**G.3 Concrete nav change.** Today, `src/lib/appMode.ts` exposes
`AppMode = 'health' | 'finance'` with `DEFAULT_MODE = 'health'`, and
`src/app/index.tsx` branches directly on it (`mode === 'finance' ? <FinanceApp/> :
<HealthApp/>`, gated only by `mode === null` during the async AsyncStorage read).
Change:

```ts
export type AppMode = 'health' | 'finance' | 'goals';
const DEFAULT_MODE: AppMode = 'goals';
```

`index.tsx`'s branch becomes a three-way switch: `'goals' → <GoalsApp/>`,
`'finance' → <FinanceApp/>`, `'health' → <HealthApp/>` (falls through to today's
existing profile-setup gate only inside the health branch, unchanged). This reuses the
existing `mode`/`useAppMode()` plumbing rather than introducing a parallel state
machine — the minimal-diff way to get a three-state root.

**G.4 `ModeSwitcher` relocation.** It stops rendering inline in `HealthApp`'s and
`FinanceApp`'s headers by default. It becomes reachable as a header action from Goals
home (tap → jump to the remembered/last domain, or a small domain picker). Health and
Finance screens gain a lightweight "back to Goals" affordance in place of (or beside)
the switcher.

**G.5 `GoalsApp` structure.**
- **Goal List** (the new landing view) — every active goal, one row each, sortable by
  priority / status / deadline, a type badge per row (metric/fund/habit/milestone),
  blocked goals visibly locked with a note on what unblocks them.
- **Goal Detail** — per-type progress display (reuses each resolver's `GoalProgress`),
  plus type-specific actions: habit check-in toggle (§F.3), milestone checklist,
  fund goal's linked-account view, metric goal's trend chart (reused from the existing
  weight UI).
- **Create Goal** — a type picker, then a per-type form. Metric creation reuses
  `src/ui/CreateChallengeScreen.tsx` under a `type: 'metric'` branch rather than
  reimplementing weight-goal creation.

**G.6 Retiring the Challenges tab.** `HealthApp.tsx`'s `Tab` union drops `'challenges'`
(currently `'home'|'food'|'weight'|'challenges'|'coach'|'profile'`).
`ChallengesScreen.tsx`'s content becomes the metric-goal list/detail view inside
`GoalsApp`, not an independently tab-routed screen. Health's dashboard may optionally
keep a small read-only "primary weight goal" glance widget, since engine-driving status
is still meaningful inside the Health tree even after Challenges retires as a
standalone tab.

**G.7 Finance tab rename.** `src/ui/finance/FinanceApp.tsx`'s `'goals'` tab (currently
backed by `src/ui/finance/GoalsScreen.tsx`) is relabeled (e.g. "Fund Goals") per §D.6 —
underlying logic unchanged.

**G.8 Coach-notes surface.** `CoachNotesFeed` gains the new narrated `goalsNote` field
(§H.4) alongside its existing content.

---

## §H Coaching Integration

**H.1 Rule.** Same call, same payload object, extended. Never a second LLM call, for
either the weekly note or the on-demand chat (§H.7). The coach **narrates what
resolvers computed and never overrides or recomputes anything.**

**H.2 `CoachPayload` extension** (`src/coaching/types.ts`):

```ts
interface CoachGoalSummary {
  externalId: string;
  type: 'metric' | 'fund' | 'habit' | 'milestone';
  title: string;
  pct: number | null;
  status: GoalProgress['status'];
  daysUntilTargetDate: number | null;
  blocked: boolean;
}

interface CoachPayload {
  // ...existing fields unchanged...
  goals: CoachGoalSummary[];        // capped, e.g. top 10 by priority/recency
  goalsAggregate: {
    activeCount: number;
    blockedCount: number;
    completedThisWeekCount: number;
  };
}
```

**H.3 A new, coaching-owned signal union — not a change to Engine's `Reason`.**

```ts
type GoalSignal =
  | { code: 'GOAL_COMPLETED'; goalExternalId: string; title: string }
  | { code: 'GOAL_BLOCKED'; goalExternalId: string; title: string; blockedByTitle: string }
  | { code: 'GOAL_DEADLINE_NEAR'; goalExternalId: string; title: string; daysLeft: number };
```

Carried as a new `goalSignals: GoalSignal[]` payload field, parallel to (never merged
into) `reasons: Reason[]`. This keeps Engine's `Reason` union untouched, per §B.3.

**H.4 Deterministic fallback + validation extension**
(`supabase/functions/_shared/coachNoteLogic.ts`, `numberGuard.ts`):
- Add `goalsNote: string` to `CoachNoteContent`/`CoachNote`.
- Extend `fallbackNote()` with a new branch keyed on `goalSignals`, same pattern as the
  existing reason-keyed branches (e.g. `GOAL_BLOCKED` present → "X is on hold until Y is
  done"; `GOAL_COMPLETED` present → "you finished X this week"; else a generic "N goals
  active, M blocked" summary).
- Extend `collectAllowedNumbers()` to loop `payload.goals`, pushing each `pct` (reuses
  the existing `×100` percent-match rule already coded for `seedShare`) and
  `daysUntilTargetDate`, plus the three `goalsAggregate` counts, onto the allow-list.
  **Every new number the coach might narrate must be added here** — same anti-
  hallucination guarantee the weight/finance narration already has.

**H.5 Duplication tax.** `supabase/functions/_shared/types.ts` (the hand-kept Deno
mirror of `CoachPayload`, required because the Edge Function can't import RN source)
must be updated with the identical shape. Flagged here explicitly so it isn't a silent
gap discovered during implementation — Coaching already pays this tax for the existing
fields; this module inherits it rather than introducing something new.

**H.6 Cadence coupling, stated plainly.** Weekly coach-note generation stays gated on
Engine's 7-day recompute interval in v1 (§B.5). A week with only Finance/habit/milestone
movement (no weight recompute) will not get fresh *weekly-note* narration until the
next recompute fires. Accepted v1 tradeoff — the fix is the on-demand surface, not a
new trigger.

**H.7 On-demand Q&A surface — extend it too, not only the weekly note.** The app
already has a chat-style ad-hoc coaching surface distinct from the weekly note —
`src/coach-chat/` (`askCoach.ts`) + `supabase/functions/coach-chat/`, sharing the same
`numberGuard.ts` guard, plus a Finance-specific analog (`finance-coach-chat`). This BRD
requires the same `goals[]` / `goalsAggregate` context be available to `askCoach.ts`'s
existing context assembly — extend the existing context object rather than building a
parallel one — so a question like *"what's blocking the CB350 fund?"* or *"how's my
reading habit this week?"* is answerable immediately, not only in the next weekly note.
This is still "extend an existing surface," not a new coaching call: the weekly note
and the on-demand chat are the app's two existing coach entry points, and goal data
must reach both.

---

## §I Failure & Edge Cases

**AT1 — No data yet.** A habit with zero logs, a milestone with zero items, a fund goal
with no linked-account activity, or a metric goal below Engine's `minLoggedDays`/
`minWeighIns` thresholds → resolver returns `status: 'no_data'`. UI shows a neutral
empty state. The coach must not fabricate progress for it — `no_data` goals are
excluded from, or clearly marked in, the narrated `goals[]` summary.

**AT2 — Deleted or missing source module underneath a binding.** A Challenge marked
`status: 'deleted'`, a finance account archived, or a habit soft-deleted → the resolver
returns `no_data` with `detail.sourceMissing: true`, **never throws**. UI shows "source
no longer available" with a re-link or archive call-to-action. The `goals` row itself
is never auto-deleted — soft-delete posture only, consistent with every other table in
this app.

**AT3 — Deadline passed without completion.** "Overdue" is computed once, at the
goal-list assembly layer (the same layer that runs `applyBlocking`, §D.4) by comparing
`target_date` to today — not duplicated inside each resolver.

**AT4 — Blocked goal.** Forced to `status: 'blocked'` by the `applyBlocking` pass. The
coach must not suggest action on a blocked goal (enforced via `goalSignals`/the number
allowlist — a blocked goal's narration is limited to "blocked by X," not a progress
suggestion). UI shows a lock icon and names the predecessor goal.

**AT5 — Goal edited mid-flight.** Because progress is always derived live (§B.1), a
field edit takes effect on the very next resolve with no migration needed — a strength
of the derive-don't-store design. Metric-specific wrinkle: editing `goalWeightKg` or
`targetDate` on a metric goal must **not** silently reset `startWeightKg`/`startDate` —
only the existing, metric-resolver-specific `restartChallenge` operation does that, and
it stays a metric-only operation, never promoted to a generic goal-editing action.

**AT6 — Cross-device local-only metric data.** Direct consequence of "defer sync"
(§B.4). A synced `goals` row of type `metric` opened on a new device has a
`challengeId` binding that resolves to nothing locally on that device → same
`sourceMissing` path as AT2, but documented here as an **accepted, permanent v1 state**,
not a bug to be triaged later.

---

## §J Build Order & What's Deferred Past v1

**J.1 Build order.**
1. Migration for `goals` / `habits` / `habit_log` / `goal_milestone_items` +
   `resetAccount.ts` wiring.
2. Generic goals CRUD + the `resolveGoalProgress` dispatch function.
3. Resolvers, in order: **fund** (thin wrapper, fastest) → **milestone** (simplest new
   logic) → **habit** (new tables + check-in UX) → **metric** (heaviest: absorbs
   Challenge, retires the Challenges tab).
4. Goals-home navigation rework (`AppMode`/`index.tsx` three-way switch, `ModeSwitcher`
   relocation, Finance tab rename).
5. Coaching integration (`CoachPayload` extension, `GoalSignal` union, fallback/
   `numberGuard` updates, Deno-mirror update, `askCoach.ts` context extension).
6. Blocking/priority pass + acceptance-test hardening for §I.

**J.2 Explicitly deferred past v1.**
- Metric-goal Supabase sync (a future migration of the Challenge table).
- Many-to-many / AND-gated blocking (a future `goal_blocks` join table).
- Habit cadence variety beyond `count_per_window` (e.g. daily-required, streaks).
- Loosening the weekly coach-note trigger to fire on goal-only changes independent of
  Engine's recompute cadence — accepted as a v1 limitation, mitigated by the on-demand
  chat surface (§H.7).
- Milestone item reordering or rich sub-tasks — a flat ordered checklist only in v1.
- A dedicated goals digest/report screen beyond the Goal List + weekly note.
- Any goal-specific push notification beyond the existing weekly coach-note
  notification.

---

## Milestone-Proxy Recommendation

The brief asks whether legitimately unquantifiable goals ("regain sharp thinking,"
"develop a good fashion sense") should be proxied by measurable stand-ins or left
unmodeled.

**Recommendation: proxy them through the two types that already exist —
`milestone` for one-off deliverables, `habit` for anything inherently recurring — and
add no fifth type, no self-rating mechanic, no free-text journaling field.**

Justification:
- "Sharp thinking" becomes a `milestone` goal with proxy checklist items ("finish a
  deep-work challenge," "run a week without a phone in the bedroom") or a `habit` goal
  if the proxy is countable and recurring ("5 deep-work sessions / week," "sleep
  logged 6 nights / week"). "Fashion sense" becomes a `milestone` checklist of concrete
  wardrobe/learning steps. Both route through resolver contracts already specified in
  §E — no new resolver, no new anti-hallucination surface.
- A self-rating slider or journaling field would need its own hallucination guard (free
  text and subjective scores aren't allowlist-friendly the way counts and checkmarks
  are) and would break the derive-don't-store invariant (§B.1) everything else in this
  document depends on — there is no "source of truth" a self-rating derives from other
  than itself.
- This keeps the whole module honest about what it can and can't measure: proxies are
  explicit and user-chosen at goal-creation time, not an implicit numeric score
  pretending to quantify something it can't.

Self-rating sliders and free-text journaling are explicitly **out of scope**, not
merely deferred.
