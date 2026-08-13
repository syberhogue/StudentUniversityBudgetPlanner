create extension if not exists pgcrypto;

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  student_program text,
  expected_graduation_year int,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.budget_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null default 'My Ontario Tech Plan',
  degree_years_count int default 4 not null,
  tuition_inflation_rate numeric default 3.0 not null,
  plan_snapshot jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.savings_accounts (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.budget_plans(id) on delete cascade not null,
  account_name text not null,
  starting_balance numeric not null default 0,
  account_type text not null check (account_type in ('RESP', 'Savings')),
  created_at timestamptz default now() not null
);

create table public.yearly_budgets (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.budget_plans(id) on delete cascade not null,
  year_number int not null,
  planning_mode text not null default 'standard' check (planning_mode in ('standard', 'semester')),
  living_situation text not null default 'off-campus',
  student_program text,
  include_summer boolean default false not null,
  created_at timestamptz default now() not null,
  unique (plan_id, year_number)
);

create table public.income_items (
  id uuid default gen_random_uuid() primary key,
  yearly_budget_id uuid references public.yearly_budgets(id) on delete cascade not null,
  term text not null check (term in ('academic', 'fall', 'winter', 'summer')),
  name text not null,
  amount numeric not null default 0,
  category text not null
);

create table public.expense_items (
  id uuid default gen_random_uuid() primary key,
  yearly_budget_id uuid references public.yearly_budgets(id) on delete cascade not null,
  term text not null check (term in ('academic', 'fall', 'winter', 'summer')),
  name text not null,
  total_amount numeric not null default 0,
  covered_by_others numeric default 0 not null,
  category text not null
);

create table public.household_splits (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.budget_plans(id) on delete cascade not null,
  household_name text not null,
  ratio_percent numeric not null default 50
);

create table public.deadline_events (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.budget_plans(id) on delete cascade not null,
  title text not null,
  event_date date not null,
  category text not null check (category in ('OSAP', 'Tuition', 'SAFA', 'Scholarship', 'Custom')),
  notes text default '' not null,
  completed boolean default false not null
);

create table public.share_links (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.budget_plans(id) on delete cascade not null,
  token text unique not null,
  access_level text not null default 'read' check (access_level in ('read', 'edit')),
  payload jsonb,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

create index budget_plans_user_id_idx on public.budget_plans(user_id);
create index savings_accounts_plan_id_idx on public.savings_accounts(plan_id);
create index yearly_budgets_plan_id_idx on public.yearly_budgets(plan_id);
create index income_items_yearly_budget_id_idx on public.income_items(yearly_budget_id);
create index expense_items_yearly_budget_id_idx on public.expense_items(yearly_budget_id);
create index household_splits_plan_id_idx on public.household_splits(plan_id);
create index deadline_events_plan_id_idx on public.deadline_events(plan_id);
create index share_links_plan_id_idx on public.share_links(plan_id);

alter table public.profiles enable row level security;
alter table public.budget_plans enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.yearly_budgets enable row level security;
alter table public.income_items enable row level security;
alter table public.expense_items enable row level security;
alter table public.household_splits enable row level security;
alter table public.deadline_events enable row level security;
alter table public.share_links enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "budget_plans_select_own"
  on public.budget_plans for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "budget_plans_insert_own"
  on public.budget_plans for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budget_plans_update_own"
  on public.budget_plans for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budget_plans_delete_own"
  on public.budget_plans for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "savings_accounts_owner_access"
  on public.savings_accounts for all
  to authenticated
  using (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = savings_accounts.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = savings_accounts.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

create policy "yearly_budgets_owner_access"
  on public.yearly_budgets for all
  to authenticated
  using (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = yearly_budgets.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = yearly_budgets.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

create policy "income_items_owner_access"
  on public.income_items for all
  to authenticated
  using (
    exists (
      select 1
      from public.yearly_budgets
      join public.budget_plans on budget_plans.id = yearly_budgets.plan_id
      where yearly_budgets.id = income_items.yearly_budget_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.yearly_budgets
      join public.budget_plans on budget_plans.id = yearly_budgets.plan_id
      where yearly_budgets.id = income_items.yearly_budget_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

create policy "expense_items_owner_access"
  on public.expense_items for all
  to authenticated
  using (
    exists (
      select 1
      from public.yearly_budgets
      join public.budget_plans on budget_plans.id = yearly_budgets.plan_id
      where yearly_budgets.id = expense_items.yearly_budget_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.yearly_budgets
      join public.budget_plans on budget_plans.id = yearly_budgets.plan_id
      where yearly_budgets.id = expense_items.yearly_budget_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

create policy "household_splits_owner_access"
  on public.household_splits for all
  to authenticated
  using (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = household_splits.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = household_splits.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

create policy "deadline_events_owner_access"
  on public.deadline_events for all
  to authenticated
  using (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = deadline_events.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = deadline_events.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

create policy "share_links_owner_access"
  on public.share_links for all
  to authenticated
  using (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = share_links.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.budget_plans
      where budget_plans.id = share_links.plan_id
      and budget_plans.user_id = (select auth.uid())
    )
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.budget_plans to authenticated;
grant select, insert, update, delete on public.savings_accounts to authenticated;
grant select, insert, update, delete on public.yearly_budgets to authenticated;
grant select, insert, update, delete on public.income_items to authenticated;
grant select, insert, update, delete on public.expense_items to authenticated;
grant select, insert, update, delete on public.household_splits to authenticated;
grant select, insert, update, delete on public.deadline_events to authenticated;
grant select, insert, update, delete on public.share_links to authenticated;
