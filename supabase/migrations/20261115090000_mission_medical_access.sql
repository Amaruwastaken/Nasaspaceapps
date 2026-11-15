-- Privileged roles must be assigned by an administrator in auth.users.raw_app_meta_data.
-- Never authorize access from editable registration/user_metadata roles.
create or replace function public.can_review_mission()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = (select auth.uid())
    and raw_app_meta_data ->> 'role' in ('doctor','capitan'));
$$;
create or replace function public.can_read_mission_member(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = (select auth.uid()) or (
    public.can_review_mission() and exists (
      select 1 from public.profiles viewer join public.profiles member on member.mission = viewer.mission
      where viewer.id = (select auth.uid()) and member.id = p_user_id
    )
  );
$$;
-- Mission membership is an authorization boundary and cannot be self-edited.
revoke update (mission) on public.profiles from authenticated;

alter table public.records enable row level security;
revoke all on table public.records from public, anon, authenticated;
grant select, insert, update on table public.records to authenticated;
drop policy if exists "leer registros" on public.records;
drop policy if exists "Users read own records" on public.records;
create policy "Users read own records" on public.records
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "crear mis registros" on public.records;
create policy "Users insert own records" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "editar mis registros" on public.records;
create policy "Users update own records" on public.records
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- daily_sensor is an invoker-secured view over telemetry and profiles, not a table.
alter view public.daily_sensor set (security_invoker = true);
revoke all on table public.daily_sensor from public, anon, authenticated;
grant select on table public.daily_sensor to authenticated;

create or replace function public.get_mission_report_members()
returns table (id uuid, username text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_review_mission() then raise exception 'Doctor or captain authorization required' using errcode = '42501'; end if;
  return query select member.id, member.username from public.profiles member
    join public.profiles viewer on viewer.mission = member.mission
    where viewer.id = (select auth.uid()) order by member.username, member.id;
end;
$$;
create or replace function public.get_report_mission_start(p_user_id uuid)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_read_mission_member(p_user_id) then raise exception 'Access denied' using errcode = '42501'; end if;
  return (select mission_start_at from public.profiles where id = p_user_id);
end;
$$;
revoke all on function public.can_review_mission() from public, anon;
revoke all on function public.can_read_mission_member(uuid) from public, anon;
revoke all on function public.get_mission_report_members() from public, anon;
revoke all on function public.get_report_mission_start(uuid) from public, anon;
grant execute on function public.can_review_mission(), public.can_read_mission_member(uuid), public.get_mission_report_members(), public.get_report_mission_start(uuid) to authenticated;
create policy "Mission medical profile readers" on public.profiles
  for select to authenticated using (public.can_read_mission_member(id));
create policy "Mission medical readers" on public.telemetry for select to authenticated using (public.can_read_mission_member(user_id));
create policy "Mission medical readers" on public.records for select to authenticated using (public.can_read_mission_member(user_id));
