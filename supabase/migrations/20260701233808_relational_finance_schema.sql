create schema if not exists private;

create or replace function private.finance_period_from_item(item jsonb, fallback_year integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(item->>'period', ''),
    concat(
      coalesce(nullif(item->>'year', '')::integer, fallback_year),
      '-',
      case item->>'month'
        when 'Janeiro' then '01' when 'Fevereiro' then '02' when 'Março' then '03'
        when 'Abril' then '04' when 'Maio' then '05' when 'Junho' then '06'
        when 'Julho' then '07' when 'Agosto' then '08' when 'Setembro' then '09'
        when 'Outubro' then '10' when 'Novembro' then '11' when 'Dezembro' then '12'
        else '01'
      end
    )
  );
$$;

revoke all on function private.finance_period_from_item(jsonb, integer) from public, anon, authenticated;

create table if not exists public.households (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.finance_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  selected_period text not null check (selected_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  active_owner text not null check (active_owner in ('Rebeca', 'Gustavo')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.finance_people (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  owner text not null check (owner in ('Rebeca', 'Gustavo')),
  name text not null,
  whatsapp text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.finance_cards (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  owner text not null check (owner in ('Rebeca', 'Gustavo')),
  name text not null,
  card_type text not null check (card_type in ('debit', 'credit', 'food')),
  balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.finance_forecasts (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  owner text not null check (owner in ('Rebeca', 'Gustavo')),
  competence date not null,
  kind text not null check (kind in ('income', 'expense')),
  description text not null,
  category text,
  planned numeric(14,2) not null default 0,
  actual numeric(14,2),
  payment_status text,
  recurrence text,
  series_id bigint,
  person_id bigint,
  card_id bigint,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.finance_transactions (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  owner text not null check (owner in ('Rebeca', 'Gustavo')),
  competence date not null,
  kind text not null check (kind in ('income', 'expense')),
  title text not null,
  category text,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null,
  source text,
  series_id bigint,
  person_id bigint,
  card_id bigint,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.finance_alerts (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  owner text not null check (owner in ('Rebeca', 'Gustavo')),
  title text not null,
  activation_date date,
  amount numeric(14,2) not null default 0,
  active boolean not null default true,
  person_id bigint,
  card_id bigint,
  transaction_id bigint,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.savings_goals (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  goal_type text not null,
  completed boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id, completed)
);

create table if not exists public.savings_movements (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  competence date not null,
  movement_type text not null check (movement_type in ('entry', 'withdrawal')),
  amount numeric(14,2) not null check (amount >= 0),
  owner text,
  description text,
  category text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.finance_quotes (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  subject text not null,
  status text not null default 'Em andamento',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.finance_quote_items (
  household_id uuid not null,
  id bigint not null,
  quote_id bigint not null,
  name text not null,
  amount numeric(14,2) not null default 0,
  status text not null default 'Analisando',
  link text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id),
  foreign key (household_id, quote_id) references public.finance_quotes(household_id, id) on delete cascade
);

create table if not exists public.home_groups (
  household_id uuid not null references public.households(id) on delete cascade,
  id bigint not null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table if not exists public.home_items (
  household_id uuid not null,
  id bigint not null,
  group_id bigint not null,
  name text not null,
  status text not null default 'Pendente',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id),
  foreign key (household_id, group_id) references public.home_groups(household_id, id) on delete cascade
);

create table if not exists public.finance_categories (
  household_id uuid not null references public.households(id) on delete cascade,
  owner text not null check (owner in ('Rebeca', 'Gustavo')),
  name text not null,
  kind text not null default 'both' check (kind in ('income', 'expense', 'both')),
  created_at timestamptz not null default now(),
  primary key (household_id, owner, name)
);

create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists finance_people_household_owner_idx on public.finance_people(household_id, owner);
create index if not exists finance_cards_household_owner_idx on public.finance_cards(household_id, owner);
create index if not exists finance_forecasts_household_owner_competence_idx on public.finance_forecasts(household_id, owner, competence);
create index if not exists finance_forecasts_series_id_idx on public.finance_forecasts(household_id, series_id) where series_id is not null;
create index if not exists finance_transactions_household_owner_competence_idx on public.finance_transactions(household_id, owner, competence);
create index if not exists finance_transactions_series_id_idx on public.finance_transactions(household_id, series_id) where series_id is not null;
create index if not exists finance_alerts_household_owner_active_idx on public.finance_alerts(household_id, owner, active);
create index if not exists savings_movements_household_competence_idx on public.savings_movements(household_id, competence);
create index if not exists finance_quote_items_quote_id_idx on public.finance_quote_items(household_id, quote_id);
create index if not exists home_items_group_id_idx on public.home_items(household_id, group_id);

insert into public.households(id, name)
values ('00000000-0000-0000-0000-000000000001', 'Finanças de Rebeca e Gustavo')
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into public.household_members(household_id, user_id, role)
select '00000000-0000-0000-0000-000000000001', id, 'owner'
from auth.users
on conflict (household_id, user_id) do nothing;

create or replace function private.add_finance_household_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members(household_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, 'member')
  on conflict (household_id, user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.add_finance_household_member() from public, anon, authenticated;
drop trigger if exists add_finance_household_member on auth.users;
create trigger add_finance_household_member
after insert on auth.users
for each row execute function private.add_finance_household_member();

with source as (select data from public.finance_app_state where id = 'couple')
insert into public.finance_settings(household_id, selected_period, active_owner, data)
select
  '00000000-0000-0000-0000-000000000001',
  coalesce(data->>'period', private.finance_period_from_item(data, 2026)),
  coalesce(data->>'activeUser', 'Rebeca'),
  jsonb_build_object(
    'theme', data->'theme', 'sidebarColor', data->'sidebarColor', 'navOrder', data->'navOrder',
    'savings', (data->'savings') - 'movements' - 'goals' - 'completedGoals',
    'historyResetVersion', data->'historyResetVersion'
  )
from source
on conflict (household_id) do update set selected_period = excluded.selected_period, active_owner = excluded.active_owner, data = excluded.data, updated_at = now();

with source as (select data from public.finance_app_state where id = 'couple'),
accounts as (select entry.key owner, entry.value account from source cross join lateral jsonb_each(data->'users') entry),
items as (select owner, item from accounts cross join lateral jsonb_array_elements(coalesce(account->'people', '[]'::jsonb)) item)
insert into public.finance_people(household_id, id, owner, name, whatsapp, data)
select '00000000-0000-0000-0000-000000000001', (item->>'id')::bigint, owner, item->>'name', item->>'whatsapp', item from items where item ? 'id'
on conflict (household_id, id) do update set owner=excluded.owner, name=excluded.name, whatsapp=excluded.whatsapp, data=excluded.data, updated_at=now();

with source as (select data from public.finance_app_state where id = 'couple'),
accounts as (select entry.key owner, entry.value account from source cross join lateral jsonb_each(data->'users') entry),
items as (select owner, item from accounts cross join lateral jsonb_array_elements(coalesce(account->'cards', '[]'::jsonb)) item)
insert into public.finance_cards(household_id, id, owner, name, card_type, balance, credit_limit, data)
select '00000000-0000-0000-0000-000000000001', (item->>'id')::bigint, owner, item->>'name', case when item->>'cardType'='benefit' then 'food' else item->>'cardType' end, coalesce((item->>'balance')::numeric,0), coalesce((item->>'limit')::numeric,0), item from items where item ? 'id'
on conflict (household_id, id) do update set owner=excluded.owner, name=excluded.name, card_type=excluded.card_type, balance=excluded.balance, credit_limit=excluded.credit_limit, data=excluded.data, updated_at=now();

with source as (select data from public.finance_app_state where id = 'couple'),
accounts as (select entry.key owner, entry.value account from source cross join lateral jsonb_each(data->'users') entry),
items as (select owner, item from accounts cross join lateral jsonb_array_elements(coalesce(account->'forecasts', '[]'::jsonb)) item)
insert into public.finance_forecasts(household_id,id,owner,competence,kind,description,category,planned,actual,payment_status,recurrence,series_id,person_id,card_id,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,owner,to_date(private.finance_period_from_item(item,2026)||'-01','YYYY-MM-DD'),item->>'type',item->>'description',item->>'category',coalesce((item->>'planned')::numeric,0),nullif(item->>'actual','')::numeric,coalesce(item->>'fixedPaymentStatus',case when coalesce((item->>'actualConfirmed')::boolean,false) then 'Pago' else 'Pendente' end),item->>'recurrence',nullif(item->>'seriesId','')::bigint,nullif(item->>'personId','')::bigint,nullif(item->>'cardId','')::bigint,item from items where item ? 'id'
on conflict (household_id,id) do update set owner=excluded.owner,competence=excluded.competence,kind=excluded.kind,description=excluded.description,category=excluded.category,planned=excluded.planned,actual=excluded.actual,payment_status=excluded.payment_status,recurrence=excluded.recurrence,series_id=excluded.series_id,person_id=excluded.person_id,card_id=excluded.card_id,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id = 'couple'),
accounts as (select entry.key owner, entry.value account from source cross join lateral jsonb_each(data->'users') entry),
items as (select owner, item from accounts cross join lateral jsonb_array_elements(coalesce(account->'transactions', '[]'::jsonb)) item)
insert into public.finance_transactions(household_id,id,owner,competence,kind,title,category,amount,status,source,series_id,person_id,card_id,data,created_at)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,owner,to_date(private.finance_period_from_item(item,2026)||'-01','YYYY-MM-DD'),item->>'type',item->>'title',item->>'category',coalesce((item->>'amount')::numeric,0),coalesce(item->>'status','Pendente'),item->>'source',coalesce(nullif(item->>'installmentSeriesId','')::bigint,nullif(item->>'seriesId','')::bigint),nullif(item->>'personId','')::bigint,nullif(item->>'cardId','')::bigint,item,to_timestamp(coalesce(nullif(item->>'createdAt','')::double precision,nullif(item->>'id','')::double precision)/1000.0) from items where item ? 'id'
on conflict (household_id,id) do update set owner=excluded.owner,competence=excluded.competence,kind=excluded.kind,title=excluded.title,category=excluded.category,amount=excluded.amount,status=excluded.status,source=excluded.source,series_id=excluded.series_id,person_id=excluded.person_id,card_id=excluded.card_id,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id = 'couple'),
accounts as (select entry.key owner, entry.value account from source cross join lateral jsonb_each(data->'users') entry),
items as (select owner, item from accounts cross join lateral jsonb_array_elements(coalesce(account->'alerts', '[]'::jsonb)) item)
insert into public.finance_alerts(household_id,id,owner,title,activation_date,amount,active,person_id,card_id,transaction_id,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,owner,item->>'title',nullif(item->>'activationDate','')::date,coalesce((item->>'amount')::numeric,0),coalesce((item->>'active')::boolean,true),nullif(item->>'personId','')::bigint,nullif(item->>'cardId','')::bigint,nullif(item->>'transactionId','')::bigint,item from items where item ? 'id'
on conflict (household_id,id) do update set owner=excluded.owner,title=excluded.title,activation_date=excluded.activation_date,amount=excluded.amount,active=excluded.active,person_id=excluded.person_id,card_id=excluded.card_id,transaction_id=excluded.transaction_id,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id = 'couple'), items as (select item from source cross join lateral jsonb_array_elements(coalesce(data->'savings'->'movements','[]'::jsonb)) item)
insert into public.savings_movements(household_id,id,competence,movement_type,amount,owner,description,category,data,created_at)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,to_date(private.finance_period_from_item(item,2026)||'-01','YYYY-MM-DD'),item->>'type',coalesce((item->>'amount')::numeric,0),coalesce(item->>'owner',item->>'person'),item->>'description',item->>'category',item,to_timestamp((item->>'id')::double precision/1000.0) from items where item ? 'id'
on conflict (household_id,id) do update set competence=excluded.competence,movement_type=excluded.movement_type,amount=excluded.amount,owner=excluded.owner,description=excluded.description,category=excluded.category,data=excluded.data;

with source as (select data from public.finance_app_state where id = 'couple'),
items as (
  select item,false completed from source cross join lateral jsonb_array_elements(coalesce(data->'savings'->'goals','[]'::jsonb)) item
  union all
  select item,true completed from source cross join lateral jsonb_array_elements(coalesce(data->'savings'->'completedGoals','[]'::jsonb)) item
)
insert into public.savings_goals(household_id,id,name,amount,goal_type,completed,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,coalesce(item->>'name','Meta'),coalesce((item->>'amount')::numeric,0),coalesce(item->>'type','annual'),completed,item from items where item ? 'id'
on conflict (household_id,id,completed) do update set name=excluded.name,amount=excluded.amount,goal_type=excluded.goal_type,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id='couple'), items as (select item from source cross join lateral jsonb_array_elements(coalesce(data->'sharedQuotes','[]'::jsonb)) item)
insert into public.finance_quotes(household_id,id,subject,status,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,item->>'subject',coalesce(item->>'status','Em andamento'),item from items where item ? 'id'
on conflict (household_id,id) do update set subject=excluded.subject,status=excluded.status,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id='couple'), quotes as (select item quote from source cross join lateral jsonb_array_elements(coalesce(data->'sharedQuotes','[]'::jsonb)) item), items as (select quote,item from quotes cross join lateral jsonb_array_elements(coalesce(quote->'items','[]'::jsonb)) item)
insert into public.finance_quote_items(household_id,id,quote_id,name,amount,status,link,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,(quote->>'id')::bigint,item->>'name',coalesce((item->>'value')::numeric,0),coalesce(item->>'status',case when coalesce((item->>'checked')::boolean,false) then 'Escolhida' else 'Analisando' end),item->>'link',item from items where item ? 'id'
on conflict (household_id,id) do update set quote_id=excluded.quote_id,name=excluded.name,amount=excluded.amount,status=excluded.status,link=excluded.link,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id='couple'), items as (select item from source cross join lateral jsonb_array_elements(coalesce(data->'homeGroups','[]'::jsonb)) item)
insert into public.home_groups(household_id,id,name,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,item->>'name',item from items where item ? 'id'
on conflict (household_id,id) do update set name=excluded.name,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id='couple'), groups as (select item group_item from source cross join lateral jsonb_array_elements(coalesce(data->'homeGroups','[]'::jsonb)) item), items as (select group_item,item from groups cross join lateral jsonb_array_elements(coalesce(group_item->'items','[]'::jsonb)) item)
insert into public.home_items(household_id,id,group_id,name,status,data)
select '00000000-0000-0000-0000-000000000001',(item->>'id')::bigint,(group_item->>'id')::bigint,item->>'name',coalesce(item->>'status','Pendente'),item from items where item ? 'id'
on conflict (household_id,id) do update set group_id=excluded.group_id,name=excluded.name,status=excluded.status,data=excluded.data,updated_at=now();

with source as (select data from public.finance_app_state where id='couple'), accounts as (select entry.key owner,entry.value account from source cross join lateral jsonb_each(data->'users') entry), categories as (
  select owner,item->>'category' name,item->>'type' kind from accounts cross join lateral jsonb_array_elements(coalesce(account->'transactions','[]'::jsonb)) item
  union all
  select owner,item->>'category' name,item->>'type' kind from accounts cross join lateral jsonb_array_elements(coalesce(account->'forecasts','[]'::jsonb)) item
)
insert into public.finance_categories(household_id,owner,name,kind)
select '00000000-0000-0000-0000-000000000001',owner,name,case when count(distinct kind)>1 then 'both' else max(kind) end from categories where name is not null and name<>'' group by owner,name
on conflict (household_id,owner,name) do update set kind=excluded.kind;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.finance_settings enable row level security;
alter table public.finance_people enable row level security;
alter table public.finance_cards enable row level security;
alter table public.finance_forecasts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_alerts enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_movements enable row level security;
alter table public.finance_quotes enable row level security;
alter table public.finance_quote_items enable row level security;
alter table public.home_groups enable row level security;
alter table public.home_items enable row level security;
alter table public.finance_categories enable row level security;

drop policy if exists households_member_access on public.households;
create policy households_member_access on public.households for select to authenticated
using (exists (select 1 from public.household_members member where member.household_id=households.id and member.user_id=(select auth.uid())));

drop policy if exists household_members_own_access on public.household_members;
create policy household_members_own_access on public.household_members for select to authenticated
using (user_id=(select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'finance_settings','finance_people','finance_cards','finance_forecasts','finance_transactions','finance_alerts',
    'savings_goals','savings_movements','finance_quotes','finance_quote_items','home_groups','home_items','finance_categories'
  ] loop
    execute format('drop policy if exists household_member_access on public.%I', table_name);
    execute format(
      'create policy household_member_access on public.%I for all to authenticated using (exists (select 1 from public.household_members member where member.household_id=%I.household_id and member.user_id=(select auth.uid()))) with check (exists (select 1 from public.household_members member where member.household_id=%I.household_id and member.user_id=(select auth.uid())))',
      table_name, table_name, table_name
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select on public.households, public.household_members to authenticated;
grant select, insert, update, delete on public.finance_settings, public.finance_people, public.finance_cards, public.finance_forecasts, public.finance_transactions, public.finance_alerts, public.savings_goals, public.savings_movements, public.finance_quotes, public.finance_quote_items, public.home_groups, public.home_items, public.finance_categories to authenticated;
