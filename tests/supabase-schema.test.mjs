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
  const [page, script, coreMigration, migration, resetMigration] = await Promise.all([
    readFile(path.join(process.cwd(), 'Interfaz', 'mision.html'), 'utf8'),
    readFile(path.join(process.cwd(), 'Interfaz', 'mission-plan.js'), 'utf8'),
    readFile(path.join(migrationDir, '20261115080000_ensure_core_schema.sql'), 'utf8'),
    readFile(path.join(migrationDir, '20261115130000_ensure_shared_mission_table.sql'), 'utf8'),
    readFile(path.join(migrationDir, '20261115120000_reset_shared_mission.sql'), 'utf8'),
  ]);

  assert.match(page, /mission-plan\.js/);
  assert.match(coreMigration, /create\s+table\s+if\s+not\s+exists\s+public\.missions/i);
  assert.match(migration, /create\s+table\s+if\s+not\s+exists\s+public\.missions/i);
  assert.match(migration, /grant\s+select\s+on\s+table\s+public\.missions\s+to\s+authenticated/i);
  assert.match(script, /rpc\('get_shared_mission'\)/);
  assert.match(script, /rpc\('save_shared_mission'/);
  assert.match(script, /data\s*!==\s*'Farmacias Similunares'/);
  assert.match(script, /rpc\('reset_shared_mission'\)/);
  const saveHandler = script.slice(script.indexOf("saveButton.addEventListener"), script.indexOf("resetButton.addEventListener"));
  assert.ok(saveHandler.indexOf('await supabaseReady') < saveHandler.indexOf('getCurrentUser()?.id'));
  assert.match(resetMigration, /delete\s+from\s+public\.missions/i);
});
