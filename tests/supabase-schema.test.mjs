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
