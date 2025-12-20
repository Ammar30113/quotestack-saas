-- Rollback plan for schema_alignment.sql.
-- WARNING: This can drop data in new columns. Review before running.

begin;

alter table public.deals disable row level security;
alter table public.quotes disable row level security;

drop policy if exists deals_owner_select on public.deals;
drop policy if exists deals_owner_modify on public.deals;
drop policy if exists quotes_owner_select on public.quotes;
drop policy if exists quotes_owner_modify on public.quotes;

alter table public.deals alter column user_id drop default;
alter table public.quotes alter column user_id drop default;

alter table public.deals alter column user_id drop not null;
alter table public.quotes alter column user_id drop not null;

alter table public.deals drop column if exists user_id;
alter table public.quotes drop column if exists user_id;

alter table public.deals drop column if exists currency;
alter table public.deals drop column if exists description;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deals'
      and column_name = 'company_name'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deals'
      and column_name = 'name'
  ) then
    alter table public.deals rename column company_name to name;
  end if;
end $$;

commit;
