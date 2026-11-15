alter table public.telemetry
  add column simulated_data jsonb,
  add constraint telemetry_simulated_data_object
    check (
      simulated_data is null
      or (
        jsonb_typeof(simulated_data) = 'object'
        and octet_length(simulated_data::text) <= 16384
      )
    );

comment on column public.telemetry.simulated_data is
  'Explicitly simulated fallback values for report metrics; never authoritative health data.';

create index telemetry_user_simulated_latest
  on public.telemetry (user_id, ts desc, id desc)
  where simulated_data is not null;

grant insert (simulated_data) on table public.telemetry to authenticated;

with latest as (
  select distinct on (user_id) id
  from public.telemetry
  order by user_id, ts desc, id desc
)
update public.telemetry as telemetry
set simulated_data = jsonb_build_object(
  'pvt', floor(random() * 181 + 240)::integer,
  'tlx', floor(random() * 41 + 30)::integer,
  'amsler', (array['green','yellow','red'])[floor(random() * 3 + 1)::integer],
  'sleep', round((6.5 + random() * 2)::numeric, 1),
  'hrv', floor(random() * 31 + 40)::integer,
  'heartRate', case when telemetry.is_simulated then telemetry.hr else floor(random() * 31 + 60)::integer end,
  'co2', case when telemetry.is_simulated then telemetry.co2 else floor(random() * 551 + 450)::integer end,
  'fluids', round((1.6 + random() * 0.8)::numeric, 1),
  'radiation', round((0.1 + random() * 0.35)::numeric, 2),
  'dose', round((5 + random() * 25)::numeric, 1),
  'gravity', coalesce(telemetry.gravity, 0.38),
  'pressure', round((97 + random() * 5)::numeric, 1),
  'ventilation', round((0.08 + random() * 0.08)::numeric, 2),
  'bloodPressure', floor(random() * 21 + 105)::integer::text || '/' || floor(random() * 16 + 65)::integer::text,
  'heartRecovery', floor(random() * 16 + 20)::integer,
  'arrhythmia', 0,
  'perfusion', round((1 + random() * 0.9)::numeric, 1),
  'glucose', floor(random() * 21 + 80)::integer,
  'bmr', round((0.95 + random() * 0.1)::numeric, 2),
  'bodyFat', jsonb_build_object('value', round((12 + random() * 6)::numeric, 1), 'sex', 'male'),
  'calories', floor(random() * 21 + 90)::integer,
  'sodium', floor(random() * 601 + 1600)::integer,
  'calcium', floor(random() * 201 + 1000)::integer,
  'vitaminD', floor(random() * 201 + 800)::integer,
  'caffeine', floor(random() * 201)::integer,
  'sleepApnea', floor(random() * 5)::integer,
  'medication', jsonb_build_object('takenPercent', floor(random() * 6 + 95)::integer, 'doubleDose', 'no'),
  'spo2', case when telemetry.is_simulated then telemetry.spo2 else floor(random() * 5 + 95)::integer end,
  'oxygen', round((20.5 + random() * 1.5)::numeric, 1),
  'respiratoryRate', case when telemetry.is_simulated then telemetry.resp else floor(random() * 9 + 12)::integer end,
  'temperature', case when telemetry.is_simulated then telemetry.temp else round((36.3 + random() * 0.8)::numeric, 1) end,
  'sleepEfficiency', floor(random() * 11 + 85)::integer,
  'orthostatic', jsonb_build_object(
    'hrRise', floor(random() * 14 + 5)::integer,
    'systolicDrop', floor(random() * 9)::integer,
    'diastolicDrop', floor(random() * 6)::integer,
    'symptoms', 'none'
  ),
  'who5', floor(random() * 36 + 50)::integer,
  'hemoglobin', jsonb_build_object('value', round((13 + random() * 3)::numeric, 1), 'sex', 'male'),
  'leanMassChange', round((-1 + random() * 3)::numeric, 1),
  'boneDensity', jsonb_build_object(
    'tScore', round((-0.8 + random() * 1.3)::numeric, 1),
    'monthlyLoss', round((random() * 0.3)::numeric, 2)
  )
)
from latest
where telemetry.id = latest.id
  and telemetry.simulated_data is null;
