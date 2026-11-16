# Nasaspaceapps

Static prototype for astronaut health check-ins, reporting, and approximate
solar-system mission planning.

## Supabase

Install dependencies with `npm install`. The browser app reads its public
Supabase URL and publishable key from `Interfaz/supabase-config.js`; never put a
service-role key in browser code.

`Backend/backend.ts` provides optional typed Supabase helpers for trusted
server-side scripts. Its `adminClient()` requires `SUPABASE_SERVICE_KEY` and
must never be used in the browser. The static-site build reads its public
configuration from the process environment; Vercel should define
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or the documented aliases).

### Web registration and sign-in

The static pages in `Interfaz/` use Supabase Auth. Configure the project URL
and its publishable key (or `anon` key) in `Interfaz/supabase-config.js`; this
key is designed for browser use. Never put a `service_role` key in client files.

Apply `supabase/migrations/20261114223000_registry_auth.sql` to the project.
Supabase Auth stores credentials; the trigger creates the related profile in
`public."Registry"` and stores the name in `"Usuario"`. The `"Contraseña"`
column is not used for authentication and should not contain passwords.
Registration also requests a role (commander, engineer, pilot, doctor, or
scientist) and displays it beside the username. In this prototype, accounts
registered as doctors or commanders can view reports from all accounts; all
data must be fictional.

### Metrics and reports

`Interfaz/report-data.js` defines metrics, their ranges, and whether they are
manual or automatic. `captura.html` asks for the manual metrics one at a time
and saves responses to Supabase for the authenticated account.
`report-source.js` queries available indicators from `records`, `daily_sensor`,
and `telemetry`. If a value is missing, the report may use
`telemetry.simulated_data`; it labels the value as “Simulated (prototype)” and
does not use it for alerts or health scores.

The body view uses `Interfaz/Imagenes/silueta-cuerpo.jpeg` and only shows
regions with available measurements.

### Emergency system

The report adds 2 points for each red indicator and 1.25 for each yellow
indicator (rounding the total to the nearest integer). A score above 10 records
the crew member as critical in Supabase, and the interface queries active
statuses to display them in a panel at the lower left. Also apply
`supabase/migrations/20261115020000_health_emergency_notifications.sql`,
`supabase/migrations/20261115020300_health_alert_popup.sql`, and
`supabase/migrations/20261115024000_live_health_emergency_panel.sql`.

### Shared mission

`Interfaz/mision.html` loads the shared mission from `public.missions` and saves
the name, route, duration, stay mode, time zone, date, and clocks with
`save_shared_mission`. It requires
`20261115110000_persist_shared_mission.sql`;
`20261115120000_reset_shared_mission.sql` allows the shared mission to be
deleted when it is reset. Saving or resetting requires a Supabase session. The
plan uses the fixed code `Farmacias Similunares`, so every account sees the
same mission. `20261115130000_ensure_shared_mission_table.sql` creates the
shared mission table when it is missing, applies authenticated read access, and
reloads the PostgREST schema cache.

### Supabase-connected check-in on Vercel

Vercel project: `nasaspaceapps-farmacias-similunares`. The project directory is
the repository root.

- `npm run build` copies `Interfaz` to `dist` and generates public configuration
  from `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. It also supports the
  `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_ANON_KEY` aliases. It never publishes
  `service_role` or `sb_secret` keys.
- `npm test` runs the configuration and persistence tests.
- Apply the migrations in `supabase/migrations/` in order to the connected
  Supabase project. `20261115040000_unify_measurements_telemetry.sql` removes
  only the previous `manual_measurements` table and adds validated check-in
  JSON, telemetry JSON, and a simulated-data marker to `telemetry`.
- `20261115050000_create_user_profiles.sql` fills in missing profiles for
  existing Auth accounts and creates them for new registrations, so `telemetry`
  rows satisfy their relationship with `profiles`. If there is no mission in
  the Auth metadata, it uses `Farmacias Similunares`.
- `20261115060000_simulate_missing_report_metrics.sql` adds
  `telemetry.simulated_data` and fills only the latest row for each account.
  New check-ins also generate prototype values only for omitted fields; those
  values are labeled simulated and do not replace real answers.
- `20261115070000_mission_start_at.sql` adds a start date to `profiles`. The
  Mission page lets users save it; the report sums daily radiation only from
  that date and shows the interval used.
- Check-in requires a sign-in and confirms the insert before opening the
  Report. If it fails, answers stay on the page; it does not simulate a local
  save.
- Each check-in submission adds one row to `telemetry`, including manual
  answers and a generic automatic reading marked as simulated. Existing
  automatic readings can continue using sensor columns;
  `manual_measurements` remains `NULL` for those rows.
- The Report queries the latest `telemetry` check-in. A test skipped in that
  check-in is not replaced with an older value from `records`. Existing sensors
  and alerts keep their current connections.
- Old `localStorage` data is not imported automatically; it is no longer the
  source for the report.

The migration does not replace the existing `records`, `daily_sensor`,
`telemetry`, or `Registry` tables; they must be configured along with the
previous migrations. The new migration only removes the old
`manual_measurements` table and extends `telemetry`. A new Supabase project must
have its base schema configured before sensors and alerts are enabled.

### Doctor and commander dashboard

`Interfaz/doctor.html` allows users to select crew members and view their
indicators, check-in tests, and log and sensor history. This is a read-only
dashboard; personal check-ins and alerts keep their usual flow.

Apply these migrations in order:
`20261115070000_mission_start_at.sql`,
`20261115080000_ensure_core_schema.sql`,
`20261115090000_mission_medical_access.sql`, and
`20261115100000_demo_doctor_signup_access.sql` (for connected projects, use
`supabase db push`). The last migration allows the doctor or commander role
selected during registration to enable read access to all reports in this
instance.

**Do not use with real data.** Anyone can register as a doctor or commander and
view other accounts’ data; the corresponding notice also appears in
`doctor.html`. The `daily_sensor` view follows the policies of its source
tables.
