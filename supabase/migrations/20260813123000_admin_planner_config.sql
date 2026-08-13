create table public.planner_config (
  key text primary key,
  config jsonb not null,
  updated_at timestamptz default now() not null
);

alter table public.planner_config enable row level security;

create policy "planner_config_read_all"
  on public.planner_config for select
  to anon, authenticated
  using (true);

create policy "planner_config_admin_insert"
  on public.planner_config for insert
  to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "planner_config_admin_update"
  on public.planner_config for update
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "planner_config_admin_delete"
  on public.planner_config for delete
  to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.planner_config to anon, authenticated;
grant insert, update, delete on public.planner_config to authenticated;

insert into public.planner_config (key, config)
values (
  'default',
  '{
    "programs": {
      "engineering": { "label": "Engineering", "tuition": 9200, "ancillary": 1350 },
      "computerScience": { "label": "Computer Science", "tuition": 8600, "ancillary": 1300 },
      "healthSci": { "label": "Health Sciences", "tuition": 7900, "ancillary": 1225 },
      "nursing": { "label": "Nursing", "tuition": 8300, "ancillary": 1250 },
      "arts": { "label": "Arts & General Studies", "tuition": 7000, "ancillary": 1125 }
    },
    "housing": {
      "on-campus": { "label": "Simcoe Village Residence", "housing": 9800, "food": 5900, "utilities": 0, "description": "Residence and campus dining for first-year planning." },
      "south-village": { "label": "South Village Residence", "housing": 10800, "food": 5600, "utilities": 0, "description": "Residence-style housing with meal plan support." },
      "off-campus": { "label": "Off-Campus Oshawa Rental", "housing": 8800, "food": 3800, "utilities": 1050, "description": "Shared Oshawa rental benchmark with utilities." },
      "home": { "label": "Living at Home", "housing": 0, "food": 1800, "utilities": 0, "description": "Commuter plan with reduced housing costs." }
    },
    "mealPlans": {
      "none": { "label": "No Meal Plan", "cost": 0, "description": "Use estimated groceries instead." },
      "light": { "label": "Light Meal Plan", "cost": 3600, "description": "Reduced campus dining support." },
      "standard": { "label": "Standard Meal Plan", "cost": 5900, "description": "Default first-year campus dining estimate." },
      "full": { "label": "Full Meal Plan", "cost": 7200, "description": "Higher campus dining usage estimate." }
    }
  }'::jsonb
)
on conflict (key) do update
set config = excluded.config,
    updated_at = now();
