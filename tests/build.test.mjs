import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite,publicSupabaseConfig} from '../scripts/build.mjs';
const publicEnv = {SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public'};
const jwt = role => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({role})).toString('base64url')}.test`;
test('supports Vercel public aliases and legacy anon keys',() => {
  assert.deepEqual(publicSupabaseConfig({NEXT_PUBLIC_SUPABASE_URL:publicEnv.SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt('anon')}),{url:publicEnv.SUPABASE_URL,key:jwt('anon')});
  assert.equal(publicSupabaseConfig({...publicEnv,SUPABASE_PUBLISHABLE_KEY:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_alias'}).key,'sb_publishable_alias');
});
test('fails without actual public configuration in Vercel builds',() => {
  assert.throws(() => publicSupabaseConfig({VERCEL:'1'}),/Missing/);
  assert.throws(() => publicSupabaseConfig({SUPABASE_URL:publicEnv.SUPABASE_URL,SUPABASE_SERVICE_KEY:'sb_secret_do_not_expose'}),/Missing/);
});
test('rejects private keys and invalid URLs without exposing credentials',() => {
  for (const key of ['sb_secret_do_not_expose',jwt('service_role'),jwt('authenticated'),'not-a-public-key']) assert.throws(() => publicSupabaseConfig({...publicEnv,SUPABASE_PUBLISHABLE_KEY:key}),error => !error.message.includes(key) && /publishable/.test(error.message));
  assert.throws(() => publicSupabaseConfig({...publicEnv,SUPABASE_URL:'https://user:password@example.supabase.co'}),/origin/);
  assert.throws(() => publicSupabaseConfig({...publicEnv,SUPABASE_URL:'http://example.supabase.co'}),/origin/);
  assert.throws(() => publicSupabaseConfig({...publicEnv,VERCEL:'1',SUPABASE_URL:'http://127.0.0.1:54321'}),/origin/);
  assert.equal(publicSupabaseConfig({...publicEnv,SUPABASE_URL:'http://127.0.0.1:54321'}).url,'http://127.0.0.1:54321');
});
test('copies assets and generates only public configuration',async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'nasaspaceapps-build-')), sourceDir = path.join(dir,'Interfaz');
  await mkdir(sourceDir); await writeFile(path.join(sourceDir,'Index.html'),'<h1>Page</h1>'); await writeFile(path.join(sourceDir,'supabase-config.js'),'old-config'); await writeFile(path.join(sourceDir,'.env'),'PRIVATE_VALUE=should-not-ship');
  const output = await buildSite({sourceDir,env:{...publicEnv,SUPABASE_SERVICE_KEY:'sb_secret_should_not_ship',DATABASE_URL:'postgres://secret'}});
  assert.equal(await readFile(path.join(output,'Index.html'),'utf8'),'<h1>Page</h1>');
  const config = await readFile(path.join(output,'supabase-config.js'),'utf8');
  assert(config.includes(publicEnv.SUPABASE_PUBLISHABLE_KEY)); assert(!config.includes('sb_secret') && !config.includes('postgres://') && !config.includes('old-config')); assert.equal(await readFile(path.join(sourceDir,'supabase-config.js'),'utf8'),'old-config'); await assert.rejects(access(path.join(output,'.env')));
});
test('invalid configuration preserves existing output',async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'nasaspaceapps-build-')), sourceDir = path.join(dir,'Interfaz');
  await mkdir(sourceDir); await mkdir(path.join(dir,'dist')); await writeFile(path.join(dir,'dist','sentinel.txt'),'preserved');
  await assert.rejects(buildSite({sourceDir,env:{VERCEL:'1'}}),/Missing/); assert.equal(await readFile(path.join(dir,'dist','sentinel.txt'),'utf8'),'preserved');
});
