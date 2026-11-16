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
