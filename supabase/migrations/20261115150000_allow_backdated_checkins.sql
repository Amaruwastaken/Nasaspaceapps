alter table public.telemetry
  add column if not exists recorded_date date;

update public.telemetry
set recorded_date = (ts at time zone 'UTC')::date
where manual_measurements is not null
  and recorded_date is null;

comment on column public.telemetry.recorded_date is
  'Calendar date assigned to a user-entered check-in; ts remains the save timestamp.';

create index if not exists telemetry_user_manual_recorded_date
  on public.telemetry (user_id, recorded_date desc, ts desc, id desc)
  where manual_measurements is not null;

grant insert (recorded_date) on table public.telemetry to authenticated;
