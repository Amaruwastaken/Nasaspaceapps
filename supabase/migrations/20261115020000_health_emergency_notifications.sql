create table if not exists public.health_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  source_user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  score integer not null check (score > 10),
  created_at timestamptz not null default now()
);

create index if not exists health_notifications_recipient_created_idx
  on public.health_notifications (recipient_id, created_at desc);

alter table public.health_notifications enable row level security;
revoke all on table public.health_notifications from public, anon, authenticated;
grant select on table public.health_notifications to authenticated;

create policy "Users read their health notifications"
  on public.health_notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create table if not exists public.health_emergency_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active boolean not null default false,
  score integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.health_emergency_state enable row level security;
revoke all on table public.health_emergency_state from public, anon, authenticated;

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
      'Alerta de salud crítica de tripulante ' || crew_name,
      p_score
    from auth.users as u
    where u.id <> caller_id;
  end if;
end;
$$;

revoke all on function public.sync_health_emergency(integer) from public, anon;
grant execute on function public.sync_health_emergency(integer) to authenticated;
