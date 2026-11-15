import {cp,mkdir,rm,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readEnv = (env,names) => names.map(name => env[name]?.trim()).find(Boolean);
export function publicSupabaseConfig(env = process.env) {
  const url = readEnv(env,['SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL']);
  const key = readEnv(env,['SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_ANON_KEY']);
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y/o SUPABASE_PUBLISHABLE_KEY; se admiten sus alias publicos de Vercel.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('SUPABASE_URL debe ser una URL valida.'); }
  const local = ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && !env.VERCEL && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || !['','/'].includes(parsed.pathname)) throw new Error('SUPABASE_URL debe ser el origen HTTPS publico del proyecto Supabase.');
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey && key.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));
      publicKey = payload.role === 'anon' && /^[A-Za-z0-9_.-]+$/.test(key);
    } catch { /* Reject malformed/private tokens without printing their value. */ }
  }
  if (!publicKey) throw new Error('Solo se permite una clave Supabase publishable o anon; nunca service_role ni sb_secret.');
  return {url:parsed.origin,key};
}
export async function buildSite({sourceDir = path.join(root,'Interfaz'),env = process.env} = {}) {
  const config = publicSupabaseConfig(env);
  const source = path.resolve(sourceDir), parent = path.dirname(source);
  const output = path.resolve(parent,'dist');
  // Check the absolute deletion target before removing generated output.
  if (path.basename(source) !== 'Interfaz' || path.dirname(output) !== parent || output === source || output === path.parse(output).root) throw new Error('Rutas de compilacion invalidas.');
  if (!(await stat(source)).isDirectory()) throw new Error('No se encontro el directorio Interfaz.');
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
  try { await buildSite(); process.stdout.write('Sitio compilado en dist con configuracion publica de Supabase.\n'); }
  catch (error) { process.stderr.write(`No se pudo compilar: ${error.message}\n`); process.exitCode = 1; }
}
