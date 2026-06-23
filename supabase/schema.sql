create table if not exists public.finance_app_state (
  id text primary key default 'couple',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  owner_id uuid not null references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.finance_app_state enable row level security;

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
using (id = 'couple' and owner_id = (select auth.uid()));

drop policy if exists "authenticated couple can create state" on public.finance_app_state;
create policy "authenticated couple can create state"
on public.finance_app_state
for insert
to authenticated
with check (
  id = 'couple'
  and owner_id = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "authenticated couple can update state" on public.finance_app_state;
create policy "authenticated couple can update state"
on public.finance_app_state
for update
to authenticated
using (id = 'couple' and owner_id = (select auth.uid()))
with check (
  id = 'couple'
  and owner_id = (select auth.uid())
  and updated_by = (select auth.uid())
);
