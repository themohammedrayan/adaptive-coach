# Adaptive Weight & Nutrition Coach

Personal Android app that turns a weight goal into a daily calorie + macro
target and self-corrects that target weekly from the actual weight trend.
A small AI coach explains every change so the adaptive numbers stay
trustworthy.

Built module by module from the BRDs in Notion (Master BRD + 5 child BRDs).
See [AGENTS.md](AGENTS.md) for structure, build order, and hard rules.

## Stack

- React Native / Expo SDK 57 (dev build, Android-only v1) + expo-router
- Supabase — Postgres, Auth, Edge Functions (model API proxy for coach notes)
- Health Connect via `react-native-health-connect` (from module 2 onward)

## Develop

```bash
npm install
npm test          # jest
npx expo start    # dev server
```
