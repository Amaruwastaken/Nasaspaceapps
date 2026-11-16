-- Extend the validated Captura snapshot with organ-level crew measurements.
-- Unclassified lab and symptom values remain display-only until interpreted by
-- the flight medical team; validation does not assign a clinical diagnosis.
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
    if metric_key in (
      'pvt','tlx','who5','perfusion','fluids','bloodPressure','heartRecovery','arrhythmia','pressure','ventilation',
      'bmr','bodyFat','calories','sodium','calcium','vitaminD','sleepApnea',
      'oxygen','sleepEfficiency','hemoglobin','leanMassChange','alt','ast','bilirubin',
      'nauseaScore','appetite','urineOutput','urineSpecificGravity','creatinine','bun',
      'bowelFrequency','fiber'
    ) then
      if metric_key = 'bloodPressure' then
        if jsonb_typeof(raw_value) <> 'object' then return false; end if;
        for field_key, field_value in select key, value from jsonb_each(raw_value) loop
          if field_key not in ('systolic','diastolic') or jsonb_typeof(field_value) <> 'number' then return false; end if;
          number_value := field_value::text::numeric;
          if number_value <> trunc(number_value) then return false; end if;
          if (field_key = 'systolic' and (number_value < 40 or number_value > 300))
             or (field_key = 'diastolic' and (number_value < 20 or number_value > 200)) then return false; end if;
        end loop;
      elsif jsonb_typeof(raw_value) <> 'number' then return false;
      else
        number_value := raw_value::text::numeric;
        if number_value < -100 or number_value > 9007199254740991 then return false; end if;
        if metric_key in ('pvt','tlx','who5','heartRecovery','arrhythmia','pressure','ventilation','bodyFat','calories','sodium','calcium','vitaminD','sleepApnea','oxygen','sleepEfficiency','hemoglobin','alt','ast','bilirubin','nauseaScore','appetite','urineOutput','urineSpecificGravity','creatinine','bun','bowelFrequency','fiber','perfusion','fluids','leanMassChange','bmr') and number_value < 0 and metric_key not in ('leanMassChange') then return false; end if;
        if metric_key in ('nauseaScore','appetite') and number_value > 10 then return false; end if;
        if metric_key = 'perfusion' and (number_value > 30 or number_value * 10 <> trunc(number_value * 10)) then return false; end if;
        if metric_key in ('pvt','tlx','who5','heartRecovery','arrhythmia','calories','sodium','calcium','vitaminD','sleepApnea','sleepEfficiency','nauseaScore','appetite','urineOutput','bowelFrequency','fiber') and number_value <> trunc(number_value) then return false; end if;
        if metric_key = 'tlx' and number_value > 100 or metric_key = 'who5' and number_value > 100 or metric_key = 'sleepEfficiency' and number_value > 100 or metric_key = 'bodyFat' and number_value > 100 or metric_key = 'oxygen' and number_value > 100 or metric_key = 'calories' and number_value > 300 then return false; end if;
        if metric_key = 'fluids' and (number_value > 20 or number_value * 10 <> trunc(number_value * 10)) then return false; end if;
        if metric_key = 'heartRecovery' and number_value > 250 or metric_key = 'arrhythmia' and number_value > 1000 or metric_key = 'pressure' and (number_value > 200 or number_value * 10 <> trunc(number_value * 10)) or metric_key = 'ventilation' and (number_value > 10 or number_value * 100 <> trunc(number_value * 100)) then return false; end if;
        if metric_key = 'bodyFat' and number_value * 10 <> trunc(number_value * 10) or metric_key = 'hemoglobin' and number_value * 10 <> trunc(number_value * 10) or metric_key = 'leanMassChange' and (number_value < -100 or number_value > 100 or number_value * 10 <> trunc(number_value * 10)) then return false; end if;
        if metric_key in ('sodium','calcium') and number_value > 20000 or metric_key = 'vitaminD' and number_value > 100000 or metric_key = 'sleepApnea' and number_value > 100 then return false; end if;
        if metric_key in ('alt','ast') and (number_value > 10000 or number_value * 10 <> trunc(number_value * 10)) or metric_key = 'bilirubin' and (number_value > 100 or number_value * 100 <> trunc(number_value * 100)) then return false; end if;
        if metric_key = 'urineOutput' and number_value > 20000 or metric_key = 'creatinine' and (number_value > 100 or number_value * 100 <> trunc(number_value * 100)) or metric_key = 'bun' and (number_value > 1000 or number_value * 10 <> trunc(number_value * 10)) then return false; end if;
        if metric_key = 'urineSpecificGravity' and (number_value < 1 or number_value > 1.1) then return false; end if;
        if metric_key = 'urineSpecificGravity' and number_value * 1000 <> trunc(number_value * 1000) or metric_key = 'bmr' and (number_value > 3 or number_value * 100 <> trunc(number_value * 100)) then return false; end if;
      end if;
    elsif metric_key in ('amsler','stoolConsistency') then
      if metric_key = 'amsler' and raw_value not in ('"green"'::jsonb, '"yellow"'::jsonb, '"red"'::jsonb) then return false; end if;
      if metric_key = 'stoolConsistency' and raw_value not in ('"type1"'::jsonb,'"type2"'::jsonb,'"type3"'::jsonb,'"type4"'::jsonb,'"type5"'::jsonb,'"type6"'::jsonb,'"type7"'::jsonb) then return false; end if;
    elsif metric_key in ('medication','orthostatic','boneDensity','gastricSymptoms') then
      if jsonb_typeof(raw_value) <> 'object' then return false; end if;
      for field_key, field_value in select key, value from jsonb_each(raw_value) loop
        if metric_key = 'medication' and field_key = 'doubleDose' then
          if field_value not in ('"yes"'::jsonb, '"no"'::jsonb) then return false; end if;
        elsif metric_key = 'orthostatic' and field_key = 'symptoms' then
          if field_value not in ('"none"'::jsonb, '"dizzy"'::jsonb, '"presyncope"'::jsonb, '"syncope"'::jsonb) then return false; end if;
        elsif (metric_key = 'medication' and field_key = 'takenPercent') or (metric_key = 'orthostatic' and field_key in ('hrRise','systolicDrop','diastolicDrop')) then
          if jsonb_typeof(field_value) <> 'number' then return false; end if;
          number_value := field_value::text::numeric;
          if number_value < 0 or number_value > 9007199254740991 or number_value <> trunc(number_value) then return false; end if;
          if field_key = 'takenPercent' and number_value > 100 then return false; end if;
        elsif metric_key = 'boneDensity' and field_key in ('tScore','monthlyLoss') then
          if jsonb_typeof(field_value) <> 'number' then return false; end if;
          number_value := field_value::text::numeric;
          if field_key = 'tScore' and (number_value < -5 or number_value > 5 or number_value * 10 <> trunc(number_value * 10)) then return false; end if;
          if field_key = 'monthlyLoss' and (number_value < 0 or number_value > 20 or number_value * 100 <> trunc(number_value * 100)) then return false; end if;
        elsif metric_key = 'gastricSymptoms' and field_key in ('bloating','indigestion','abdominalDiscomfort') then
          if jsonb_typeof(field_value) <> 'number' then return false; end if;
          number_value := field_value::text::numeric;
          if number_value < 0 or number_value > 10 or number_value <> trunc(number_value) then return false; end if;
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
