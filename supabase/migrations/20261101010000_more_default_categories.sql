-- More everyday default categories (Cigarettes, Rickshaw, Tea & Snacks, ...).
-- 1) New signups get the full list. 2) Existing users are backfilled (only missing names are added).
-- Safe to run once on top of 20261101000000_initial_schema.sql.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.categories (user_id, name, icon, color, type, is_default) values
    (new.id, 'Food',              'utensils',        '#c2410c', 'expense', true),
    (new.id, 'Tea & Snacks',      'coffee',          '#a16207', 'expense', true),
    (new.id, 'Groceries',         'shopping-basket', '#4d7c0f', 'expense', true),
    (new.id, 'Transport',         'bus',             '#0369a1', 'expense', true),
    (new.id, 'Rickshaw',          'bike',            '#0e7490', 'expense', true),
    (new.id, 'Cigarettes',        'cigarette',       '#78716c', 'expense', true),
    (new.id, 'Bills',             'receipt',         '#7c3aed', 'expense', true),
    (new.id, 'Mobile & Internet', 'smartphone',      '#4338ca', 'expense', true),
    (new.id, 'Rent',              'house',           '#9a3412', 'expense', true),
    (new.id, 'Education',         'graduation-cap',  '#1d4ed8', 'expense', true),
    (new.id, 'Clothing',          'shirt',           '#be123c', 'expense', true),
    (new.id, 'Personal',          'user',            '#be185d', 'expense', true),
    (new.id, 'Entertainment',     'clapperboard',    '#b45309', 'expense', true),
    (new.id, 'Health',            'heart-pulse',     '#0f766e', 'expense', true),
    (new.id, 'Gifts & Donations', 'gift',            '#c026d3', 'expense', true),
    (new.id, 'Other',             'ellipsis',        '#525252', 'expense', true),
    (new.id, 'Salary',            'banknote',        '#15803d', 'income',  true),
    (new.id, 'Business',          'store',           '#047857', 'income',  true),
    (new.id, 'Freelance',         'laptop',          '#1d4ed8', 'income',  true),
    (new.id, 'Other income',      'plus',            '#525252', 'income',  true);

  insert into public.accounts (user_id, name, type) values (new.id, 'Cash', 'cash');

  insert into public.reminder_preferences (user_id, reminder_type, enabled, reminder_time, threshold_percent) values
    (new.id, 'plan_day', false, '08:00', null),
    (new.id, 'close_day', false, '21:00', null),
    (new.id, 'budget_threshold', true, null, 90);
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Backfill existing users with any default category they don't already have (matched by name, case-insensitive).
insert into public.categories (user_id, name, icon, color, type, is_default)
select u.id, v.name, v.icon, v.color, v.type, true
from auth.users u
cross join (values
  ('Tea & Snacks',      'coffee',         '#a16207', 'expense'),
  ('Rickshaw',          'bike',           '#0e7490', 'expense'),
  ('Cigarettes',        'cigarette',      '#78716c', 'expense'),
  ('Mobile & Internet', 'smartphone',     '#4338ca', 'expense'),
  ('Rent',              'house',          '#9a3412', 'expense'),
  ('Education',         'graduation-cap', '#1d4ed8', 'expense'),
  ('Clothing',          'shirt',          '#be123c', 'expense'),
  ('Gifts & Donations', 'gift',           '#c026d3', 'expense'),
  ('Business',          'store',          '#047857', 'income')
) as v(name, icon, color, type)
where not exists (
  select 1 from public.categories c
  where c.user_id = u.id and c.type = v.type and lower(c.name) = lower(v.name)
);
