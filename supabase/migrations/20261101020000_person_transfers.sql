-- Transfers to / from people (payees): tracked separately from income, expenses and
-- own-account transfers, with an optional proof image (stored in the private `receipts` bucket,
-- path kept in transactions.receipt_path).
-- Run once, after 20261101000000_initial_schema.sql.

-- ===== payees =====
create table public.payees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index payees_user_name_idx on public.payees (user_id, lower(name));

alter table public.payees enable row level security;
create policy payees_select on public.payees for select to authenticated using (user_id = (select auth.uid()));
create policy payees_insert on public.payees for insert to authenticated with check (user_id = (select auth.uid()));
create policy payees_update on public.payees for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy payees_delete on public.payees for delete to authenticated using (user_id = (select auth.uid()));

-- ===== transactions: new type + payee reference =====
alter table public.transactions add column payee_id uuid;
alter table public.transactions
  add constraint transactions_payee_fk foreign key (payee_id, user_id) references public.payees (id, user_id);
create index transactions_user_payee_idx on public.transactions (user_id, payee_id) where payee_id is not null;

-- Replace the old type / shape checks (found by name, with a definition-based fallback).
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions drop constraint if exists transactions_check;
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.transactions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%transfer_group_id%'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.transactions
  add constraint transactions_type_check check (type in ('income', 'expense', 'transfer', 'person_transfer'));

alter table public.transactions
  add constraint transactions_shape_check check (
    (type = 'transfer' and transfer_direction is not null and transfer_group_id is not null
       and category_id is null and payee_id is null)
    or (type = 'person_transfer' and transfer_direction is not null and transfer_group_id is null
       and category_id is null and payee_id is not null)
    or (type in ('income', 'expense') and transfer_direction is null and transfer_group_id is null
       and category_id is not null and payee_id is null)
  );
