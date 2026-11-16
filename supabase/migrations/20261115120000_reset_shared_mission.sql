create or replace function public.reset_shared_mission()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.missions
  where code = 'Farmacias Similunares';

  update public.profiles
  set mission_start_at = null,
      updated_at = now()
  where mission = 'Farmacias Similunares';
end;
$$;

revoke all on function public.reset_shared_mission() from public, anon;
grant execute on function public.reset_shared_mission() to authenticated;
