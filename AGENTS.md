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
- API keys never ship in the client; all Claude calls go through a Supabase
  Edge Function.
- Android-only v1, Expo **dev build** (native Health Connect module — not
  Expo Go).

## Commands

- `npm test` — jest (engine is test-driven; run before committing)
- `npx tsc --noEmit` — typecheck
- `npx expo start` — dev server
