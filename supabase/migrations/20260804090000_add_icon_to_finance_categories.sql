-- Per-category emoji, so budget rows are scannable at a glance. Nullable: the
-- 14 seeded system categories fall back to defaults defined client-side in
-- src/finance/presetCategories.ts, so this column only ever holds a user's
-- override or a user-created category's own choice.
alter table public.finance_categories add column icon text;
