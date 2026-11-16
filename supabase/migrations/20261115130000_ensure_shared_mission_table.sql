create table if not exists public.missions (
  code text primary key,
  name text not null,
  origin text not null,
  dest text not null,
  transit_days double precision not null,
  stay_days double precision not null,
  stay_mode text not null default 'orbit' check (stay_mode in ('orbit', 'surface')),
  tz text not null default 'America/Chicago',
  start_at timestamptz,
  clock_real timestamptz,
  clock_mission timestamptz,
  time_scale double precision not null default 1
);

alter table public.missions enable row level security;
revoke all on table public.missions from public, anon, authenticated;
grant select on table public.missions to authenticated;

drop policy if exists "leer misiones" on public.missions;
drop policy if exists "crear misiones" on public.missions;
drop policy if exists "editar misiones" on public.missions;
drop policy if exists "Read shared mission" on public.missions;
create policy "Read shared mission"
  on public.missions
  for select
  to authenticated
  using (code = 'Farmacias Similunares');

notify pgrst, 'reload schema';
