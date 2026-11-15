-- Ensure the app's required base tables exist even when the project is re-applied
-- against an empty Supabase instance. These are the tables the browser app and
-- migration chain actually rely on.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'astronauta',
  mission text not null default 'Farmacias Similunares',
  sex text check (sex in ('male', 'female')),
  sim_stress numeric check (sim_stress is null or (sim_stress >= 0 and sim_stress <= 100)),
  mission_start_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_mission_username_idx
  on public.profiles (mission, username);

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (username, mission, sex, sim_stress, mission_start_at, updated_at) on table public.profiles to authenticated;

drop policy if exists "Users read mission profiles" on public.profiles;
create policy "Users read mission profiles"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create table if not exists public.telemetry (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  mts timestamptz,
  hr numeric,
  rr numeric,
  temp numeric,
  spo2 numeric,
  resp numeric,
  rad_rate numeric,
  co2 numeric,
  asleep boolean not null default false,
  phase text,
  gravity numeric,
  latency_s numeric,
  mission_day integer,
  manual_measurements jsonb,
  automatic_data jsonb,
  is_simulated boolean not null default false,
  simulated_data jsonb,
  constraint telemetry_manual_measurements_valid
    check (manual_measurements is null or public.valid_manual_measurements(manual_measurements)),
  constraint telemetry_automatic_data_object
    check (
      automatic_data is null
      or (
        jsonb_typeof(automatic_data) = 'object'
        and octet_length(automatic_data::text) <= 16384
      )
    ),
  constraint telemetry_simulated_data_object
    check (
      simulated_data is null
      or (
        jsonb_typeof(simulated_data) = 'object'
        and octet_length(simulated_data::text) <= 16384
      )
    )
);

create index if not exists telemetry_user_ts_idx
  on public.telemetry (user_id, ts desc, id desc);

alter table public.telemetry enable row level security;
revoke all on table public.telemetry from public, anon, authenticated;
grant select on table public.telemetry to authenticated;
grant insert (
  user_id,
  ts,
  mts,
  hr,
  rr,
  temp,
  spo2,
  resp,
  rad_rate,
  co2,
  asleep,
  phase,
  gravity,
  latency_s,
  mission_day,
  manual_measurements,
  automatic_data,
  is_simulated,
  simulated_data
) on table public.telemetry to authenticated;

drop policy if exists "Users read their own telemetry" on public.telemetry;
create policy "Users read their own telemetry"
  on public.telemetry
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert their own telemetry" on public.telemetry;
create policy "Users insert their own telemetry"
  on public.telemetry
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Backfill missing profile rows from auth.users so the trigger-based project flow
-- keeps working even when user accounts existed before the schema was created.
insert into public.profiles (id, username, mission)
select
  users.id,
  left(
    coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'astronauta'
    ),
    80
  ) || '-' || left(replace(users.id::text, '-', ''), 12),
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'mission'), ''),
    'Farmacias Similunares'
  )
from auth.users as users
on conflict (id) do nothing;
