alter table public.profiles
  add column if not exists mission_start_at timestamptz;

comment on column public.profiles.mission_start_at is
  'Start date of the current mission, set by the authenticated profile owner.';

create or replace function public.get_mission_start_at_for_user()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select profile.mission_start_at
  from public.profiles as profile
  where profile.id = auth.uid();
$$;

create or replace function public.set_mission_start_at_for_user(p_mission_start_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set mission_start_at = p_mission_start_at
  where id = caller_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  return p_mission_start_at;
end;
$$;

revoke all on function public.get_mission_start_at_for_user() from public, anon;
revoke all on function public.set_mission_start_at_for_user(timestamptz) from public, anon;
grant execute on function public.get_mission_start_at_for_user() to authenticated;
grant execute on function public.set_mission_start_at_for_user(timestamptz) to authenticated;
