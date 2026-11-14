alter table public."Registry"
  add column if not exists auth_user_id uuid references auth.users (id) on delete cascade;

create unique index if not exists "Registry_auth_user_id_key"
  on public."Registry" (auth_user_id);

alter table public."Registry" enable row level security;
revoke all on table public."Registry" from public, anon, authenticated;

comment on column public."Registry"."Contraseña" is
  'No almacenar contraseñas aquí. La autenticación y las contraseñas pertenecen a Supabase Auth.';

create or replace function public.handle_new_registry_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_registry on auth.users;
create trigger on_auth_user_created_registry
  after insert on auth.users
  for each row execute procedure public.handle_new_registry_user();

insert into public."Registry" (auth_user_id, "Usuario")
select
  id,
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    email
  )
from auth.users
on conflict (auth_user_id) do nothing;
