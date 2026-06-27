create table if not exists public.finance_app_state (
  id text primary key default 'couple',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  owner_id uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.finance_app_state enable row level security;
alter table public.finance_app_state alter column owner_id drop not null;
grant select, insert, update on public.finance_app_state to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.finance_app_state;
exception
  when duplicate_object then null;
end $$;

drop policy if exists "authenticated couple can read state" on public.finance_app_state;
create policy "authenticated couple can read state"
on public.finance_app_state
for select
to authenticated
using (id = 'couple');

drop policy if exists "authenticated couple can create state" on public.finance_app_state;
create policy "authenticated couple can create state"
on public.finance_app_state
for insert
to authenticated
with check (
  id = 'couple'
  and updated_by = (select auth.uid())
);

drop policy if exists "authenticated couple can update state" on public.finance_app_state;
create policy "authenticated couple can update state"
on public.finance_app_state
for update
to authenticated
using (id = 'couple')
with check (
  id = 'couple'
  and updated_by = (select auth.uid())
);

