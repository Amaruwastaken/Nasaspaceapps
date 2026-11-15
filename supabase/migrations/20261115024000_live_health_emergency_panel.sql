create or replace function public.sync_health_emergency(p_score integer)
returns void
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
  if p_score is null or p_score < 0 or p_score > 1000 then
    raise exception 'Invalid health risk score';
  end if;

  insert into public.health_emergency_state (user_id, active, score, updated_at)
  values (caller_id, p_score > 10, p_score, now())
  on conflict (user_id) do update
    set active = excluded.active,
        score = excluded.score,
        updated_at = now();
end;
$$;

revoke all on function public.sync_health_emergency(integer) from public, anon;
grant execute on function public.sync_health_emergency(integer) to authenticated;

create or replace function public.get_active_health_emergencies()
returns table (
  user_id uuid,
  crew_name text,
  score integer,
  last_updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    emergency.user_id,
    coalesce(
      nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(registry."Usuario"), ''),
      nullif(split_part(auth_user.email, '@', 1), ''),
      'Tripulante'
    )::text as crew_name,
    emergency.score,
    emergency.updated_at as last_updated_at
  from public.health_emergency_state as emergency
  join auth.users as auth_user on auth_user.id = emergency.user_id
  left join public."Registry" as registry on registry.auth_user_id = emergency.user_id
  where emergency.active and auth.uid() is not null
  order by emergency.updated_at desc;
$$;

revoke all on function public.get_active_health_emergencies() from public, anon;
grant execute on function public.get_active_health_emergencies() to authenticated;
