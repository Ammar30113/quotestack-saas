-- Required schema changes for per-user isolation on deals and quotes.

-- 1) Add user_id to tables with FK to auth.users.
alter table public.deals
    add column if not exists user_id uuid references auth.users (id);

alter table public.quotes
    add column if not exists user_id uuid references auth.users (id);

-- Ensure quotes reference deals (cascade on delete).
alter table public.quotes
    drop constraint if exists quotes_deal_id_fkey;

alter table public.quotes
    add constraint quotes_deal_id_fkey foreign key (deal_id) references public.deals (id) on delete cascade;

-- 2) Backfill user_id for existing rows before making the column NOT NULL.
-- replace the placeholder UUID with the appropriate owner for historical rows.
-- update public.deals set user_id = '<owner-uuid>' where user_id is null;
-- update public.quotes set user_id = '<owner-uuid>' where user_id is null;

alter table public.deals alter column user_id set not null;
alter table public.quotes alter column user_id set not null;

-- Optional: enforce default to current auth.uid() for inserts coming from PostgREST.
alter table public.deals alter column user_id set default auth.uid();
alter table public.quotes alter column user_id set default auth.uid();

-- 3) Enable RLS.
alter table public.deals enable row level security;
alter table public.quotes enable row level security;

-- 4) Policies: owners only (auth.uid()).
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

-- 5) (Optional) tighten default privileges.
revoke all on public.deals from public;
revoke all on public.quotes from public;
