create table public.finance_coach_chat_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  question text not null,
  answer text not null,
  source text not null check (source in ('model', 'fallback')),
  model text,
  generated_at timestamptz not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

alter table public.finance_coach_chat_turns enable row level security;

create policy "select own finance coach chat turns"
  on public.finance_coach_chat_turns for select
  using (auth.uid() = user_id);

create index finance_coach_chat_turns_user_created_idx on public.finance_coach_chat_turns (user_id, created_at desc);
