# Adaptive Weight & Nutrition Coach

Personal Android app: turns a body-weight goal into a daily calorie + macro
prescription and continuously self-corrects it from actual weight-trend data.
Single user (Rayan), no product ambitions. Expo SDK 57 — read the versioned
docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code.

## Source of truth

The spec lives in Notion: **Master BRD — Adaptive Weight & Nutrition Coach (v1)**
(locked) plus five child BRDs. Build order **1 → 2 → 3 → 5 → 4**:

1. Engine — adaptive intake engine (pure, deterministic; build first)
2. Data-Sync — Health Connect + manual weight entry
3. Food-Log — manual logging + rollup
4. Dashboard + Reminders
5. Coaching — AI coach layer (build last)

Fetch the relevant child BRD before working on a module. One module at a
time; do not scaffold ahead of the current module.

## Layout

```
src/
  app/         expo-router routes — screens and layouts only, no logic
  engine/      child BRD 1 — pure functions, no I/O, no Date.now()
  data-sync/   child BRD 2
  food-log/    child BRD 3
  dashboard/   child BRD 4
  coaching/    child BRD 5
  lib/         shared utilities (dates, supabase client)
```

Module folders are created when their module is built.

## Finance module

A personal-finance tracker bolted onto the weight/nutrition app, sharing
`src/ui/kit.tsx` and `src/ui/theme.ts` but not part of the BRD build order
above — no child BRD governs it. Route: `src/app/finance.tsx` →
`src/ui/finance/FinanceApp.tsx` (6-tab shell: Accounts, Flow, Log, Budget,
Debt, Reports). Domain logic is pure functions in `src/finance/*.ts` with
tests in `src/finance/__tests__/`; screens live in `src/ui/finance/` and
`src/ui/finance/components/`. Backend: Supabase tables `finance_*` (see
`supabase/migrations/`), reached only through `src/finance/api.ts` — screens
never call `supabase` directly. Offline writes queue through
`src/finance/outbox.ts`/`cache.ts`; `FinanceDataContext.tsx` is the single
data-access boundary all finance screens use.

Treat `FinanceDataContext.tsx` and existing screens as the pattern reference
for new work here — in particular the `entity: Entity | null` create/edit
idiom (`category === null` means create) used by `CategoryEditorModal.tsx`
and `RecurringModal.tsx`, and the `AppButton`/`Card`/`Chip`/`Field`/`Modal`
primitives in `src/ui/kit.tsx`. Keep screens consistent with each other even
though no BRD enforces it — the module drifted once already (missing edit
flows, inconsistent field labeling) from not having one.

## Hard rules (from the BRDs)

- The engine is **pure and deterministic**: time and data are parameters,
  never read from the environment. No network or persistence inside it.
- Safety clamp order is fixed: loss-rate cap → move limit → calorie floor
  (the floor is applied last and always wins).
- kcal is always **derived** (`4·protein + 4·carb + 9·fat`), never stored
  independently. Fiber is excluded from the kcal sum.
- Logged macros are **snapshotted** at log time; editing a food never
  rewrites historical entries.
- The AI coach **narrates, never computes** — displayed numbers always come
  from engine state, never from coach text.
- API keys never ship in the client; all model API calls go through the
  `coach-note` Supabase Edge Function (currently OpenAI `gpt-5-mini`;
  provider is swappable server-side only).
- Android-only v1, Expo **dev build** (native Health Connect module — not
  Expo Go).

## Commands

- `npm test` — jest (engine is test-driven; run before committing)
- `npx tsc --noEmit` — typecheck
- `npx expo start` — dev server
