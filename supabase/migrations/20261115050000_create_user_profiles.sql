create or replace function public.handle_new_registry_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  profile_mission text;
begin
  insert into public."Registry" (auth_user_id, "Usuario")
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      new.email
    )
  )
  on conflict (auth_user_id) do update
    set "Usuario" = excluded."Usuario";

  profile_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'astronauta'
    ),
    80
  );
  profile_mission := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'mission'), ''),
    'Farmacias Similunares'
  );

  insert into public.profiles (id, username, mission)
  values (
    new.id,
    profile_name || '-' || left(replace(new.id::text, '-', ''), 12),
    profile_mission
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

insert into public.profiles (id, username, mission)
select
  users.id,
  left(
    coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'username'), ''),
      nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'astronauta'
    ),
    80
  ) || '-' || left(replace(users.id::text, '-', ''), 12),
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'mission'), ''),
    'Farmacias Similunares'
  )
from auth.users as users
on conflict (id) do nothing;
