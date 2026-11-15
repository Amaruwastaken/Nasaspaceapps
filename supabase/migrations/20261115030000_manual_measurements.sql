-- Complete per-user Captura snapshots, separate from legacy records/sensor schemas.
create or replace function public.valid_manual_measurements(payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metric_key text;
  raw_value jsonb;
  field_key text;
  field_value jsonb;
  number_value numeric;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 16384 then return false; end if;
  for metric_key, raw_value in select key, value from jsonb_each(payload) loop
    if metric_key in ('pvt', 'tlx', 'who5', 'perfusion') then
      if jsonb_typeof(raw_value) <> 'number' then return false; end if;
      number_value := raw_value::text::numeric;
      if number_value < 0 or number_value > 9007199254740991 then return false; end if;
      if metric_key in ('tlx', 'who5') and number_value > 100 then return false; end if;
      if metric_key <> 'perfusion' and number_value <> trunc(number_value) then return false; end if;
      if metric_key = 'perfusion' and number_value * 10 <> trunc(number_value * 10) then return false; end if;
    elsif metric_key = 'amsler' then
      if raw_value not in ('"green"'::jsonb, '"yellow"'::jsonb, '"red"'::jsonb) then return false; end if;
    elsif metric_key in ('medication', 'orthostatic') then
      if jsonb_typeof(raw_value) <> 'object' then return false; end if;
      for field_key, field_value in select key, value from jsonb_each(raw_value) loop
        if metric_key = 'medication' and field_key = 'doubleDose' then
          if field_value not in ('"yes"'::jsonb, '"no"'::jsonb) then return false; end if;
        elsif metric_key = 'orthostatic' and field_key = 'symptoms' then
          if field_value not in ('"none"'::jsonb, '"dizzy"'::jsonb, '"presyncope"'::jsonb, '"syncope"'::jsonb) then return false; end if;
        elsif (metric_key = 'medication' and field_key = 'takenPercent') or (metric_key = 'orthostatic' and field_key in ('hrRise', 'systolicDrop', 'diastolicDrop')) then
          if jsonb_typeof(field_value) <> 'number' then return false; end if;
          number_value := field_value::text::numeric;
          if number_value < 0 or number_value > 9007199254740991 or number_value <> trunc(number_value) then return false; end if;
          if field_key = 'takenPercent' and number_value > 100 then return false; end if;
        else return false;
        end if;
      end loop;
    else return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.valid_manual_measurements(jsonb) from public, anon;
grant execute on function public.valid_manual_measurements(jsonb) to authenticated;

create table public.manual_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurements jsonb not null check (public.valid_manual_measurements(measurements)),
  created_at timestamptz not null default now()
);
comment on table public.manual_measurements is 'Complete Captura snapshots. Omitted indicators were skipped; an empty snapshot is valid.';
create index manual_measurements_user_latest on public.manual_measurements (user_id, created_at desc, id desc);
alter table public.manual_measurements enable row level security;
revoke all on table public.manual_measurements from public, anon, authenticated;
grant select on table public.manual_measurements to authenticated;
-- IDs/timestamps remain server-generated; users cannot rewrite capture history.
grant insert (user_id, measurements) on table public.manual_measurements to authenticated;
create policy "Users read their own manual measurements" on public.manual_measurements for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own manual measurements" on public.manual_measurements for insert to authenticated with check ((select auth.uid()) = user_id);

-- Bind a computed score to the user whose report supplied it. This prevents a
-- delayed browser request from applying one account's score to a new session.
create or replace function public.sync_health_emergency_for_user(p_user_id uuid, p_score integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or p_user_id is null or caller_id <> p_user_id then
    raise exception 'The authenticated user does not match the report owner'
      using errcode = '42501';
  end if;
  perform public.sync_health_emergency(p_score);
end;
$$;
revoke all on function public.sync_health_emergency_for_user(uuid, integer) from public, anon;
grant execute on function public.sync_health_emergency_for_user(uuid, integer) to authenticated;
