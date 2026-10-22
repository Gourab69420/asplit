-- Persist exact per-member expense shares for customized expense splits.
-- Existing equal-split expenses remain compatible and are interpreted by the app.
alter table public.expenses
  add column if not exists split_amounts jsonb not null default '[]'::jsonb;
