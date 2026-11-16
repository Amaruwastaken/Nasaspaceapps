-- Demo-only: doctors and captains self-select their role during registration.
-- Do not use this policy with real personal or medical data.
create or replace function public.can_review_mission()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and (
        raw_user_meta_data ->> 'role' in ('doctor','capitan')
        or raw_app_meta_data ->> 'role' in ('doctor','capitan')
      )
  );
$$;

create or replace function public.can_read_mission_member(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = (select auth.uid()) or public.can_review_mission();
$$;

create or replace function public.get_mission_report_members()
returns table (id uuid, username text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_review_mission() then
    raise exception 'Doctor or captain role required' using errcode = '42501';
  end if;
  return query
    select member.id, member.username
    from public.profiles member
    order by member.username, member.id;
end;
$$;
