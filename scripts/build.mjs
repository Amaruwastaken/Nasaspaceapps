import {cp,mkdir,rm,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readEnv = (env,names) => names.map(name => env[name]?.trim()).find(Boolean);
export function publicSupabaseConfig(env = process.env) {
  const url = readEnv(env,['SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL']);
  const key = readEnv(env,['SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_ANON_KEY']);
  if (!url || !key) throw new Error('Missing SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY; their public Vercel aliases are also supported.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('SUPABASE_URL must be a valid URL.'); }
  const local = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && !env.VERCEL && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || !['','/'].includes(parsed.pathname)) throw new Error('SUPABASE_URL must be the public HTTPS origin of the Supabase project.');
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey && key.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));
      publicKey = payload.role === 'anon' && /^[A-Za-z0-9_.-]+$/.test(key);
    } catch { /* Reject malformed/private tokens without printing their value. */ }
  }
  if (!publicKey) throw new Error('Only a Supabase publishable or anon key is allowed; never use service_role or sb_secret.');
  return {url:parsed.origin,key};
}
export async function buildSite({sourceDir = path.join(root,'Interfaz'),env = process.env} = {}) {
  const config = publicSupabaseConfig(env);
  const source = path.resolve(sourceDir), parent = path.dirname(source);
  const output = path.resolve(parent,'dist');
  // Check the absolute deletion target before removing generated output.
  if (path.basename(source) !== 'Interfaz' || path.dirname(output) !== parent || output === source || output === path.parse(output).root) throw new Error('Invalid build paths.');
  if (!(await stat(source)).isDirectory()) throw new Error('The Interfaz directory was not found.');
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
  await cp(source,output,{recursive:true,filter:entry => !path.basename(entry).startsWith('.') && path.basename(entry) !== 'node_modules'});
  const module = '// Generated from public Supabase environment variables at build time.\n'
    + `export const SUPABASE_URL = ${JSON.stringify(config.url)};\n`
    + `export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(config.key)};\n`;
  await writeFile(path.join(output,'supabase-config.js'),module,'utf8');
  return output;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await buildSite(); process.stdout.write('Site built in dist with public Supabase configuration.\n'); }
  catch (error) { process.stderr.write(`Build failed: ${error.message}\n`); process.exitCode = 1; }
}
