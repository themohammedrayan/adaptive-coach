-- How a fund goal actually gets funded, so the app can derive payments-left and
-- a projected completion date rather than only a straight-line time elapsed.
--
-- All nullable: a goal without a plan keeps working exactly as before, and the
-- resolver falls back to the calendar-elapsed read.
alter table public.finance_goals
  add column contribution_amount_minor bigint check (contribution_amount_minor is null or contribution_amount_minor > 0),
  add column contribution_cadence text check (contribution_cadence is null or contribution_cadence in ('daily', 'weekly', 'monthly')),
  add column contribution_flexible boolean not null default true;

-- Amount and cadence are meaningful only together.
alter table public.finance_goals
  add constraint finance_goals_contribution_plan_complete
  check ((contribution_amount_minor is null) = (contribution_cadence is null));
