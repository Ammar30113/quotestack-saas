-- Align QuoteStack schema with app expectations.
-- Run in a transaction. Backfill user_id before enforcing NOT NULL.

begin;

-- Rename deals.name -> deals.company_name (safe if already renamed).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deals'
      and column_name = 'name'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deals'
      and column_name = 'company_name'
  ) then
    alter table public.deals rename column name to company_name;
  end if;
end $$;

alter table public.deals
  add column if not exists currency text,
  add column if not exists description text,
  add column if not exists user_id uuid references auth.users (id);

alter table public.quotes
  add column if not exists user_id uuid references auth.users (id);

-- Optional: backfill currency from existing quotes.
-- update public.deals d
-- set currency = q.currency
-- from (
--   select deal_id, max(currency) as currency
--   from public.quotes
--   where currency is not null
--   group by deal_id
-- ) q
-- where d.id = q.deal_id and d.currency is null;

-- REQUIRED: backfill user_id for existing rows before enforcing NOT NULL.
-- update public.deals set user_id = '<owner-uuid>' where user_id is null;
-- update public.quotes set user_id = '<owner-uuid>' where user_id is null;

alter table public.deals alter column user_id set default auth.uid();
alter table public.quotes alter column user_id set default auth.uid();

do $$
begin
  if exists (select 1 from public.deals where user_id is null) then
    raise exception 'Backfill required: public.deals.user_id has nulls';
  end if;
  if exists (select 1 from public.quotes where user_id is null) then
    raise exception 'Backfill required: public.quotes.user_id has nulls';
  end if;
end $$;

alter table public.deals alter column user_id set not null;
alter table public.quotes alter column user_id set not null;

alter table public.deals enable row level security;
alter table public.quotes enable row level security;

drop policy if exists deals_owner_select on public.deals;
drop policy if exists deals_owner_modify on public.deals;
drop policy if exists quotes_owner_select on public.quotes;
drop policy if exists quotes_owner_modify on public.quotes;

create policy deals_owner_select on public.deals
  for select using (auth.uid() = user_id);

create policy deals_owner_modify on public.deals
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy quotes_owner_select on public.quotes
  for select using (auth.uid() = user_id);

create policy quotes_owner_modify on public.quotes
  for all using (
    auth.uid() = user_id
    and exists (
      select 1 from public.deals d where d.id = quotes.deal_id and d.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.deals d where d.id = quotes.deal_id and d.user_id = auth.uid()
    )
  );

revoke all on public.deals from public;
revoke all on public.quotes from public;

commit;
