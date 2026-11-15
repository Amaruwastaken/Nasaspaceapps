drop table if exists public.manual_measurements;

alter table public.telemetry
  add column manual_measurements jsonb,
  add column automatic_data jsonb,
  add column is_simulated boolean not null default false,
  add constraint telemetry_manual_measurements_valid
    check (manual_measurements is null or public.valid_manual_measurements(manual_measurements)),
  add constraint telemetry_automatic_data_object
    check (
      automatic_data is null
      or (
        jsonb_typeof(automatic_data) = 'object'
        and octet_length(automatic_data::text) <= 16384
      )
    );

comment on column public.telemetry.manual_measurements is
  'Validated user-entered Captura snapshot; null for automatic-only readings.';
comment on column public.telemetry.automatic_data is
  'Automatic telemetry payload. Prototype captures contain generated sample data.';
comment on column public.telemetry.is_simulated is
  'True when the automatic telemetry values were generated for the prototype.';

create index telemetry_user_manual_latest
  on public.telemetry (user_id, ts desc, id desc)
  where manual_measurements is not null;

alter table public.telemetry enable row level security;
drop policy if exists "leer telemetría" on public.telemetry;
create policy "leer telemetría" on public.telemetry
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insertar telemetría propia" on public.telemetry
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.telemetry from public, anon, authenticated;
grant select on table public.telemetry to authenticated;
grant insert (
  user_id,
  hr,
  rr,
  temp,
  spo2,
  resp,
  rad_rate,
  co2,
  asleep,
  phase,
  gravity,
  latency_s,
  mission_day,
  manual_measurements,
  automatic_data,
  is_simulated
) on table public.telemetry to authenticated;
