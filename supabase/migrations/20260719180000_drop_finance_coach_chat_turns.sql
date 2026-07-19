-- Coach unification — coach-chat and finance-coach-chat merged into one
-- surface backed by the existing coach_chat_turns table (already
-- domain-generic: id/question/answer/source/model/generated_at/
-- payload_hash). finance_coach_chat_turns' history isn't migrated —
-- pre-production, single-user, and the merged surface starts a fresh
-- unified thread rather than splicing two histories together.
drop table if exists public.finance_coach_chat_turns;
