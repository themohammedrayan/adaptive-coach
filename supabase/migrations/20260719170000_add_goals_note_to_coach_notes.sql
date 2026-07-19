-- Goals BRD §H.4 — the weekly coach note narrates goal signals alongside
-- the existing weight/adherence fields. Nullable/defaulted so existing rows
-- (generated before this column existed) stay valid without a backfill.
alter table public.coach_notes
  add column goals_note text not null default '';
