// Llena Supabase con astronautas y 7 días de datos de ejemplo.
// Ejecutar con: npm run seed (requiere variables en el .env de la raíz)
// ⚠️ Usa la clave service_role SOLO aquí (en tu PC). Nunca en la web.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
const sb = createClient(url, key, { auth: { persistSession: false } });

const MISSION = 'Artemis Base Camp';   // debe ser IGUAL al nombre que escribes en la web
const PASSWORD = 'astro1234';

// Perfil de cada astronauta: horas de sueño, RMSSD, reacción PVT, CO₂ y radiación diaria típicos
const crew = [
  { name: 'comandante', sleep: 8.0, rmssd: 62, pvt: 230, co2: 1800, rad: 0.7, tlx: 35 },
  { name: 'ingeniera',  sleep: 6.2, rmssd: 41, pvt: 300, co2: 3000, rad: 0.8, tlx: 58 },
  { name: 'medico',     sleep: 5.0, rmssd: 28, pvt: 380, co2: 3800, rad: 0.9, tlx: 80 },
];
const jitter = (v: number, pct: number) => v * (1 + (Math.random() - 0.5) * pct);

async function main(): Promise<void> {
  for (const c of crew) {
    const email = `${c.name}@astro.local`;           // misma regla que mail() en app.ts
    const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) { console.error(c.name, '→', error?.message); continue; }
    const id = data.user.id;

    const p = await sb.from('profiles').upsert({ id, username: c.name, mission: MISSION });
    if (p.error) { console.error('profiles:', p.error.message); continue; }

    const records = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const pvt = jitter(c.pvt, 0.12);
      return {
        user_id: id, date: d.toISOString().slice(0, 10), env: 'Órbita baja (ISS)',
        sleep: +jitter(c.sleep, 0.15).toFixed(1), tlx: +jitter(c.tlx, 0.15).toFixed(0),
        pvt: Math.round(pvt),
        pvt_max: Math.round(pvt * 1.15), fs: 0,
      };
    });
    const r = await sb.from('records').upsert(records, { onConflict: 'user_id,date' });
    console.log(r.error ? `records ${c.name}: ${r.error.message}` : `✔ ${c.name} (${records.length} registros)`);
  }
}
main();