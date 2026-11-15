alter table public.health_notifications
  add column if not exists read_at timestamptz;

grant update (read_at) on table public.health_notifications to authenticated;

drop policy if exists "Users mark their own health notifications read"
  on public.health_notifications;
create policy "Users mark their own health notifications read"
  on public.health_notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()) and read_at is not null);

update public.health_notifications as n
set message = 'Alerta, ' || coalesce(
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(split_part(u.email, '@', 1), ''),
  'Tripulante'
) || ' en estado crítico'
from auth.users as u
where u.id = n.source_user_id and n.read_at is null;

create or replace function public.sync_health_emergency(p_score integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  was_active boolean;
  crew_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if p_score < 0 or p_score > 1000 then
    raise exception 'Invalid health risk score';
  end if;

  insert into public.health_emergency_state (user_id)
  values (caller_id)
  on conflict (user_id) do nothing;

  select active into was_active
  from public.health_emergency_state
  where user_id = caller_id
  for update;

  update public.health_emergency_state
  set active = p_score > 10, score = p_score, updated_at = now()
  where user_id = caller_id;

  if p_score > 10 and not was_active then
    select coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(u.email, '@', 1), ''),
      'Tripulante'
    )
    into crew_name
    from auth.users as u
    where u.id = caller_id;

    insert into public.health_notifications (recipient_id, source_user_id, message, score)
    select
      u.id,
      caller_id,
      'Alerta, ' || crew_name || ' en estado crítico',
      p_score
    from auth.users as u;
  end if;
end;
$$;
