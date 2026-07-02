alter table public.finance_transactions
  add column if not exists affects_financial_balance boolean not null default true,
  add column if not exists savings_movement_id bigint,
  add column if not exists home_group_id bigint,
  add column if not exists home_item_id bigint;

alter table public.savings_movements
  add column if not exists linked_transaction_id bigint,
  add column if not exists home_group_id bigint,
  add column if not exists home_item_id bigint;

update public.finance_transactions
set
  affects_financial_balance = coalesce((data->>'affectsFinancialBalance')::boolean, not coalesce((data->>'savingsOnly')::boolean, false)),
  savings_movement_id = nullif(data->>'savingsMovementId','')::bigint,
  home_group_id = nullif(data->>'homeGroupId','')::bigint,
  home_item_id = nullif(data->>'homeItemId','')::bigint;

update public.savings_movements
set
  linked_transaction_id = nullif(data->>'linkedTransactionId','')::bigint,
  home_group_id = nullif(data->>'homeGroupId','')::bigint,
  home_item_id = nullif(data->>'homeItemId','')::bigint;

create index if not exists finance_transactions_savings_movement_idx
  on public.finance_transactions(household_id, savings_movement_id)
  where savings_movement_id is not null;

create index if not exists savings_movements_home_item_idx
  on public.savings_movements(household_id, home_group_id, home_item_id)
  where home_item_id is not null;
