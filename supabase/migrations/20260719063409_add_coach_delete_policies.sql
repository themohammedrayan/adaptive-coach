-- Reset-user-data support: coach_notes/coach_chat_turns only had SELECT
-- policies (writes are Edge-Function-only, per their create migrations).
-- A user must still be able to delete their own history rows directly —
-- deletion isn't a narration-integrity concern, only inserts/updates are.
create policy "delete own coach notes"
  on public.coach_notes for delete
  using (auth.uid() = user_id);

create policy "delete own coach chat turns"
  on public.coach_chat_turns for delete
  using (auth.uid() = user_id);
