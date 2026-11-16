create or replace function public.get_shared_mission()
returns table (
  code text,
  name text,
  origin text,
  dest text,
  transit_days double precision,
  stay_days double precision,
  stay_mode text,
  tz text,
  start_at timestamptz,
  clock_real timestamptz,
  clock_mission timestamptz,
  time_scale double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select mission.code, mission.name, mission.origin, mission.dest,
    mission.transit_days, mission.stay_days, mission.stay_mode, mission.tz,
    mission.start_at, mission.clock_real, mission.clock_mission, mission.time_scale
  from public.missions as mission
  where mission.code = 'Farmacias Similunares';
$$;

create or replace function public.save_shared_mission(
  p_name text,
  p_origin text,
  p_dest text,
  p_transit_days double precision,
  p_stay_days double precision,
  p_stay_mode text,
  p_tz text,
  p_start_at timestamptz,
  p_clock_real timestamptz,
  p_clock_mission timestamptz,
  p_time_scale double precision
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  mission_code constant text := 'Farmacias Similunares';
  profile_username text;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 80 then
    raise exception 'Mission name must contain 1 to 80 characters';
  end if;
  if p_origin not in ('tierra', 'luna', 'marte')
     or p_dest not in ('tierra', 'luna', 'marte')
     or p_origin = p_dest then
    raise exception 'Invalid mission route';
  end if;
  if p_transit_days is null or p_transit_days < 0 or p_transit_days >= 'Infinity'::double precision
     or p_stay_days is null or p_stay_days < 0 or p_stay_days >= 'Infinity'::double precision then
    raise exception 'Mission duration must be a finite non-negative number';
  end if;
  if p_stay_mode not in ('orbit', 'surface') then
    raise exception 'Invalid mission stay mode';
  end if;
  if p_tz is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_tz
  ) then
    raise exception 'Invalid mission time zone';
  end if;
  if p_time_scale is null or p_time_scale <= 0 or p_time_scale >= 'Infinity'::double precision then
    raise exception 'Mission time scale must be a finite positive number';
  end if;

  select left(coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'username'), ''),
    nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'astronauta'
  ), 80) || '-' || left(replace(caller_id::text, '-', ''), 12)
  into profile_username
  from auth.users as users
  where users.id = caller_id;

  if profile_username is null then
    raise exception 'Authenticated user not found' using errcode = '42501';
  end if;

  insert into public.profiles (id, username, mission, mission_start_at)
  values (caller_id, profile_username, mission_code, p_start_at)
  on conflict (id) do update
    set mission = excluded.mission,
        mission_start_at = excluded.mission_start_at,
        updated_at = now();

  update public.profiles
  set mission = mission_code,
      mission_start_at = p_start_at,
      updated_at = now();

  insert into public.missions (
    code, name, origin, dest, transit_days, stay_days, stay_mode, tz,
    start_at, clock_real, clock_mission, time_scale
  )
  values (
    mission_code, trim(p_name), p_origin, p_dest, p_transit_days, p_stay_days,
    p_stay_mode, p_tz, p_start_at, p_clock_real, p_clock_mission, p_time_scale
  )
  on conflict (code) do update set
    name = excluded.name,
    origin = excluded.origin,
    dest = excluded.dest,
    transit_days = excluded.transit_days,
    stay_days = excluded.stay_days,
    stay_mode = excluded.stay_mode,
    tz = excluded.tz,
    start_at = excluded.start_at,
    clock_real = excluded.clock_real,
    clock_mission = excluded.clock_mission,
    time_scale = excluded.time_scale;

  return mission_code;
end;
$$;

create or replace function public.get_mission_start_at_for_user()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(mission.start_at, profile.mission_start_at)
  from public.profiles as profile
  left join public.missions as mission on mission.code = profile.mission
  where profile.id = (select auth.uid());
$$;

create or replace function public.set_mission_start_at_for_user(p_mission_start_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.profiles
  set mission = 'Farmacias Similunares',
      mission_start_at = p_mission_start_at,
      updated_at = now()
  where id = caller_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  update public.profiles
  set mission = 'Farmacias Similunares',
      mission_start_at = p_mission_start_at,
      updated_at = now();

  update public.missions
  set start_at = p_mission_start_at,
      clock_real = now(),
      clock_mission = p_mission_start_at
  where code = 'Farmacias Similunares';

  return p_mission_start_at;
end;
$$;

create or replace function public.get_report_mission_start(p_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_mission_member(p_user_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return (
    select coalesce(mission.start_at, profile.mission_start_at)
    from public.profiles as profile
    left join public.missions as mission on mission.code = profile.mission
    where profile.id = p_user_id
  );
end;
$$;

alter table public.missions enable row level security;
revoke all on table public.missions from public, anon, authenticated;
grant select on table public.missions to authenticated;
drop policy if exists "leer misiones" on public.missions;
drop policy if exists "crear misiones" on public.missions;
drop policy if exists "editar misiones" on public.missions;
create policy "Read shared mission"
  on public.missions
  for select
  to authenticated
  using (code = 'Farmacias Similunares');

revoke all on function public.get_shared_mission() from public, anon;
revoke all on function public.save_shared_mission(text, text, text, double precision, double precision, text, text, timestamptz, timestamptz, timestamptz, double precision) from public, anon;
grant execute on function public.get_shared_mission(), public.save_shared_mission(text, text, text, double precision, double precision, text, text, timestamptz, timestamptz, timestamptz, double precision) to authenticated;
