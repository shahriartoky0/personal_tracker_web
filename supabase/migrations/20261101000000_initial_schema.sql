-- Personal Finance Tracker - initial schema
-- Money is stored as integer minor units (poisha) in bigint columns.
-- Every user-owned table has user_id = auth.users.id and RLS enabled.
-- Child rows reference parents with composite (id, user_id) FKs, so a row can
-- never point at another user's account/category/budget.

create extension if not exists pgcrypto;

-- ===== profiles =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  currency text not null default 'BDT' check (char_length(currency) = 3),
  timezone text not null default 'Asia/Dhaka',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== accounts =====
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('cash','bank','card','mobile','other')),
  opening_balance bigint not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index accounts_user_idx on public.accounts (user_id);

-- ===== categories =====
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text,
  color text,
  type text not null check (type in ('income','expense')),
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index categories_user_idx on public.categories (user_id);

-- ===== daily budgets =====
create table public.daily_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_date date not null,
  total_limit bigint not null check (total_limit >= 0),
  original_limit bigint not null check (original_limit >= 0),
  notes text,
  is_closed boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, budget_date)
);

create table public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  daily_budget_id uuid not null,
  category_id uuid not null,
  planned_amount bigint not null check (planned_amount >= 0),
  original_amount bigint not null check (original_amount >= 0),
  foreign key (daily_budget_id, user_id) references public.daily_budgets (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references public.categories (id, user_id),
  unique (daily_budget_id, category_id)
);
create index budget_allocations_user_idx on public.budget_allocations (user_id);

-- Saved daily template (one per user): same shape as a plan, no date.
create table public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  total_limit bigint not null check (total_limit >= 0),
  allocations jsonb not null default '[]'::jsonb, -- [{categoryId, amount}]
  updated_at timestamptz not null default now()
);

-- ===== planned expenses =====
create table public.planned_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planned_date date not null,
  category_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  expected_amount bigint not null check (expected_amount > 0),
  status text not null default 'planned' check (status in ('planned','completed','skipped')),
  created_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id)
);
create index planned_expenses_user_date_idx on public.planned_expenses (user_id, planned_date);

-- ===== transactions =====
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  type text not null check (type in ('income','expense','transfer')),
  transfer_direction text check (transfer_direction in ('in','out')),
  transfer_group_id uuid,
  amount bigint not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  merchant text check (merchant is null or char_length(merchant) <= 120),
  note text check (note is null or char_length(note) <= 500),
  planned_status text not null default 'unplanned' check (planned_status in ('planned','unplanned')),
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id),
  check (
    (type = 'transfer' and transfer_direction is not null and transfer_group_id is not null and category_id is null)
    or (type <> 'transfer' and transfer_direction is null and transfer_group_id is null and category_id is not null)
  )
);
create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);
create index transactions_user_account_idx on public.transactions (user_id, account_id);
create index transactions_transfer_idx on public.transactions (transfer_group_id) where transfer_group_id is not null;

-- ===== reminder preferences =====
create table public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_type text not null check (reminder_type in ('plan_day','close_day','budget_threshold')),
  enabled boolean not null default false,
  reminder_time time,
  threshold_percent int check (threshold_percent between 1 and 200),
  unique (user_id, reminder_type)
);

-- ===== updated_at trigger =====
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger daily_budgets_updated before update on public.daily_budgets for each row execute function public.set_updated_at();
create trigger transactions_updated before update on public.transactions for each row execute function public.set_updated_at();

-- ===== signup: profile + default categories/account/reminders =====
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.categories (user_id, name, icon, color, type, is_default) values
    (new.id, 'Food',          'utensils',        '#c2410c', 'expense', true),
    (new.id, 'Groceries',     'shopping-basket', '#4d7c0f', 'expense', true),
    (new.id, 'Transport',     'bus',             '#0369a1', 'expense', true),
    (new.id, 'Bills',         'receipt',         '#7c3aed', 'expense', true),
    (new.id, 'Personal',      'user',            '#be185d', 'expense', true),
    (new.id, 'Entertainment', 'clapperboard',    '#b45309', 'expense', true),
    (new.id, 'Health',        'heart-pulse',     '#0f766e', 'expense', true),
    (new.id, 'Other',         'ellipsis',        '#525252', 'expense', true),
    (new.id, 'Salary',        'banknote',        '#15803d', 'income',  true),
    (new.id, 'Freelance',     'laptop',          '#1d4ed8', 'income',  true),
    (new.id, 'Other income',  'plus',            '#525252', 'income',  true);

  insert into public.accounts (user_id, name, type) values (new.id, 'Cash', 'cash');

  insert into public.reminder_preferences (user_id, reminder_type, enabled, reminder_time, threshold_percent) values
    (new.id, 'plan_day', false, '08:00', null),
    (new.id, 'close_day', false, '21:00', null),
    (new.id, 'budget_threshold', true, null, 90);
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== Row Level Security =====
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','daily_budgets','budget_allocations','budget_templates',
                           'planned_expenses','transactions','reminder_preferences']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t||'_delete', t);
  end loop;
end $$;

-- ===== atomic transfer =====
-- Creates the linked out/in rows in one transaction; runs as the caller (RLS applies).
create function public.create_transfer(
  p_from uuid, p_to uuid, p_amount bigint, p_occurred_at timestamptz, p_note text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare g uuid := gen_random_uuid(); u uuid := (select auth.uid());
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_from = p_to then raise exception 'same account'; end if;
  insert into public.transactions (user_id, account_id, type, transfer_direction, transfer_group_id, amount, occurred_at, note)
  values (u, p_from, 'transfer', 'out', g, p_amount, p_occurred_at, p_note),
         (u, p_to,   'transfer', 'in',  g, p_amount, p_occurred_at, p_note);
  return g;
end $$;
revoke all on function public.create_transfer(uuid, uuid, bigint, timestamptz, text) from public, anon;
grant execute on function public.create_transfer(uuid, uuid, bigint, timestamptz, text) to authenticated;

-- ===== private receipts bucket =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
