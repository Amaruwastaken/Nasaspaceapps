import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const migrationDir = path.join(process.cwd(), 'supabase', 'migrations');

test('core app tables and mission column exist in the migration history', async () => {
  const files = (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort();
  const sql = await Promise.all(files.map(async file => readFile(path.join(migrationDir, file), 'utf8'))).then(parts => parts.join('\n'));

  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.profiles/i, 'Missing public.profiles table definition');
  assert.match(sql, /mission_start_at/i, 'Missing mission_start_at column on profiles');
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.telemetry/i, 'Missing public.telemetry table definition');
});

test('prototype doctor signup role grants access to all report members', async () => {
  const migration = await readFile(path.join(migrationDir, '20261115100000_demo_doctor_signup_access.sql'), 'utf8');

  assert.match(migration, /raw_user_meta_data\s*->>\s*'role'\s+in\s*\('doctor','capitan'\)/i);
  assert.match(migration, /select\s+member\.id,\s*member\.username\s+from\s+public\.profiles\s+member\s+order\s+by/is);
  assert.match(migration, /select\s+p_user_id\s*=\s*\(select\s+auth\.uid\(\)\)\s+or\s+public\.can_review_mission\(\)/i);
});

test('mission planner saves and reloads the shared Supabase mission', async () => {
  const [page, script, formsCss, coreMigration, migration, resetMigration, scopedUpdatesMigration] = await Promise.all([
    readFile(path.join(process.cwd(), 'Interfaz', 'mision.html'), 'utf8'),
    readFile(path.join(process.cwd(), 'Interfaz', 'mission-plan.js'), 'utf8'),
    readFile(path.join(process.cwd(), 'Interfaz', 'Forms.css'), 'utf8'),
    readFile(path.join(migrationDir, '20261115080000_ensure_core_schema.sql'), 'utf8'),
    readFile(path.join(migrationDir, '20261115130000_ensure_shared_mission_table.sql'), 'utf8'),
    readFile(path.join(migrationDir, '20261115120000_reset_shared_mission.sql'), 'utf8'),
    readFile(path.join(migrationDir, '20261115140000_scope_shared_mission_profile_updates.sql'), 'utf8'),
  ]);

  assert.match(page, /mission-plan\.js/);
  assert.match(coreMigration, /create\s+table\s+if\s+not\s+exists\s+public\.missions/i);
  assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.missions/i);
  for (const column of [
    'code text primary key',
    'name text not null',
    'origin text not null',
    'dest text not null',
    'transit_days double precision not null',
    'stay_days double precision not null',
    "stay_mode text not null default 'orbit' check (stay_mode in ('orbit', 'surface'))",
    "tz text not null default 'America/Chicago'",
    'start_at timestamptz',
    'clock_real timestamptz',
    'clock_mission timestamptz',
    'time_scale double precision not null default 1',
  ]) {
    assert.ok(migration.includes(column), `Missing missions schema definition: ${column}`);
  }
  assert.match(migration, /grant\s+select\s+on\s+table\s+public\.missions\s+to\s+authenticated/i);
  assert.match(script, /rpc\('get_shared_mission'\)/);
  assert.match(script, /rpc\('save_shared_mission'/);
  assert.match(script, /function showSuccess/);
  assert.match(script, /showSuccess\('Mission saved successfully to Supabase and shared with all accounts\.'\)/);
  assert.match(formsCss, /\.missions-hint\.is-success/);
  assert.match(script, /link\.href\s*=\s*'login\.html'/);
  assert.match(script, /showSignInPrompt\('Sign in to save the shared mission\.'\)/);
  for (const field of [
    'p_name:',
    'p_origin:',
    'p_dest:',
    'p_transit_days:',
    'p_stay_days:',
    'p_stay_mode:',
    'p_tz:',
    'p_start_at:',
    'p_clock_real:',
    'p_clock_mission:',
    'p_time_scale:',
  ]) {
    assert.ok(script.includes(field), `Mission save is missing RPC field ${field}`);
  }
  assert.match(script, /data\s*!==\s*'Farmacias Similunares'/);
  assert.match(script, /rpc\('reset_shared_mission'\)/);
  const saveHandler = script.slice(script.indexOf("saveButton.addEventListener"), script.indexOf("resetButton.addEventListener"));
  assert.ok(saveHandler.indexOf('await supabaseReady') < saveHandler.indexOf('getCurrentUser()?.id'));
  assert.ok(saveHandler.indexOf("data !== 'Farmacias Similunares'") < saveHandler.indexOf('showSuccess('));
  assert.match(resetMigration, /delete\s+from\s+public\.missions/i);
  const profileUpdates = [...scopedUpdatesMigration.matchAll(/update\s+public\.profiles\s+set[\s\S]*?;/gi)].map(([statement]) => statement);
  assert.equal(profileUpdates.length, 3);
  for (const statement of profileUpdates) {
    assert.match(statement, /\bwhere\b/i, 'Profile updates must be scoped to the shared mission or caller');
  }
});
