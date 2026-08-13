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
      "accounting": { "label": "Accounting", "tuition": 7500, "ancillary": 1250, "category": "Business & Economics" },
      "aiBusiness": { "label": "Artificial Intelligence for Business", "tuition": 7800, "ancillary": 1275, "category": "Business & Economics" },
      "businessAnalyticsAi": { "label": "Business Analytics and Artificial Intelligence", "tuition": 7900, "ancillary": 1275, "category": "Business & Economics" },
      "cybersecurityBusiness": { "label": "Cybersecurity for Business", "tuition": 7800, "ancillary": 1275, "category": "Business & Economics" },
      "economicsCommerce": { "label": "Economics (Commerce)", "tuition": 7400, "ancillary": 1250, "category": "Business & Economics" },
      "entrepreneurship": { "label": "Entrepreneurship", "tuition": 7400, "ancillary": 1250, "category": "Business & Economics" },
      "finance": { "label": "Finance", "tuition": 7500, "ancillary": 1250, "category": "Business & Economics" },
      "marketing": { "label": "Marketing", "tuition": 7400, "ancillary": 1250, "category": "Business & Economics" },
      "humanResources": { "label": "Organizational Behaviour and Human Resources Management", "tuition": 7400, "ancillary": 1250, "category": "Business & Economics" },
      "commerceTechManagement": { "label": "Technology Management (Bachelor of Commerce)", "tuition": 7600, "ancillary": 1250, "category": "Business & Economics" },
      "artificialIntelligenceCs": { "label": "Artificial Intelligence (Computer Science)", "tuition": 8700, "ancillary": 1325, "category": "AI & Technology" },
      "computerScience": { "label": "Computer Science", "tuition": 8600, "ancillary": 1300, "category": "AI & Technology" },
      "dataScience": { "label": "Data Science", "tuition": 8600, "ancillary": 1300, "category": "AI & Technology" },
      "gameDevelopment": { "label": "Information Technology - Game Development and Interactive Media", "tuition": 8400, "ancillary": 1300, "category": "AI & Technology" },
      "networkingSecurity": { "label": "Information Technology - Networking and Information Technology Security", "tuition": 8400, "ancillary": 1300, "category": "AI & Technology" },
      "itTechnologyManagement": { "label": "Information Technology - Technology Management", "tuition": 8200, "ancillary": 1300, "category": "AI & Technology" },
      "integratedMathComputerScience": { "label": "Integrated Mathematics and Computer Science", "tuition": 8300, "ancillary": 1280, "category": "AI & Technology" },
      "interactiveComputing": { "label": "Interactive Computing", "tuition": 8300, "ancillary": 1280, "category": "AI & Technology" },
      "softwareDevelopment": { "label": "Software Development", "tuition": 8300, "ancillary": 1280, "category": "AI & Technology" },
      "videoGamesCreativeIndustries": { "label": "Video Games, Creative Industries and Society (BIT)", "tuition": 8200, "ancillary": 1280, "category": "AI & Technology" },
      "automotiveEngineering": { "label": "Automotive Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "comprehensiveEngineering": { "label": "Comprehensive Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "electricalEngineering": { "label": "Electrical Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "manufacturingEngineering": { "label": "Manufacturing Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "mechanicalEngineering": { "label": "Mechanical Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "mechatronicsEngineering": { "label": "Mechatronics Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "softwareEngineering": { "label": "Software Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "nuclearEngineering": { "label": "Nuclear Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "industrialEngineering": { "label": "Industrial Engineering", "tuition": 9200, "ancillary": 1350, "category": "Engineering" },
      "energyEngineering": { "label": "Energy Engineering", "tuition": 9200, "ancillary": 1350, "category": "Energy & Sustainability" },
      "computationalPhysics": { "label": "Computational Physics", "tuition": 7800, "ancillary": 1250, "category": "Science" },
      "biologicalScience": { "label": "Biological Science", "tuition": 7800, "ancillary": 1250, "category": "Science" },
      "chemistry": { "label": "Chemistry", "tuition": 7800, "ancillary": 1250, "category": "Science" },
      "forensicScience": { "label": "Forensic Science", "tuition": 7900, "ancillary": 1250, "category": "Science" },
      "healthSci": { "label": "Health Sciences", "tuition": 7900, "ancillary": 1225, "category": "Health Sciences" },
      "kinesiology": { "label": "Kinesiology", "tuition": 7900, "ancillary": 1225, "category": "Health Sciences" },
      "medicalLaboratoryScience": { "label": "Medical Laboratory Science", "tuition": 8300, "ancillary": 1250, "category": "Health Sciences" },
      "nursing": { "label": "Nursing", "tuition": 8300, "ancillary": 1250, "category": "Health Sciences" },
      "publicHealth": { "label": "Public Health", "tuition": 7800, "ancillary": 1225, "category": "Health Sciences" },
      "communicationDigitalMedia": { "label": "Communication and Digital Media Studies", "tuition": 7000, "ancillary": 1125, "category": "Social Science & Humanities" },
      "criminologyJustice": { "label": "Criminology and Justice", "tuition": 7000, "ancillary": 1125, "category": "Social Science & Humanities" },
      "forensicPsychology": { "label": "Forensic Psychology", "tuition": 7100, "ancillary": 1125, "category": "Social Science & Humanities" },
      "legalStudies": { "label": "Legal Studies", "tuition": 7000, "ancillary": 1125, "category": "Social Science & Humanities" },
      "politicalScience": { "label": "Political Science", "tuition": 7000, "ancillary": 1125, "category": "Social Science & Humanities" },
      "psychology": { "label": "Psychology", "tuition": 7100, "ancillary": 1125, "category": "Social Science & Humanities" },
      "sociologyTechInnovation": { "label": "Sociology, Technology and Innovation", "tuition": 7000, "ancillary": 1125, "category": "Social Science & Humanities" },
      "concurrentEducation": { "label": "Concurrent Education", "tuition": 7200, "ancillary": 1150, "category": "Education" },
      "earlyChildhoodStudies": { "label": "Early Childhood Studies", "tuition": 7000, "ancillary": 1125, "category": "Education" },
      "educationalStudies": { "label": "Educational Studies", "tuition": 7000, "ancillary": 1125, "category": "Education" }
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
