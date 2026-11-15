// Cliente Supabase + acceso a datos del backend (sin DOM: la interfaz vive en /Interfaz).
// Todo lo que antes era pantalla (login, PVT, registro, umbrales, tarjetas) ya lo cubren
// Interfaz/auth.js, captura.js, digital-tests.js, report-data.js y report.js.
import 'dotenv/config'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/** Cliente con la clave publicable: respeta RLS (hay que iniciar sesión antes). */
export const supabase: SupabaseClient = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_PUBLISHABLE_KEY')
)

/** Cliente administrativo (service_role): solo para scripts del backend, nunca en el navegador. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_KEY'), {
    auth: { persistSession: false },
  })
}

/* ---------- Tipos (reflejan el esquema de supabase/migrations) ---------- */

/** telemetry: flujo de sensores. Las columnas tras `mission_day` son las mediciones automáticas del reporte. */
export interface TelemetryRow {
  id: number; user_id: string; ts: string; mts: string | null
  hr: number; rr: number; temp: number; spo2: number; resp: number; rad_rate: number; co2: number
  asleep: boolean; phase: string | null; gravity: number | null; latency_s: number | null; mission_day: number | null
  is_simulated: boolean
  rad_dose_msv: number | null; sleep_hours: number | null; sleep_efficiency: number | null; sleep_apnea_per_h: number | null
  hrv_rmssd: number | null; bp_systolic: number | null; bp_diastolic: number | null
  heart_recovery_bpm: number | null; arrhythmia_events: number | null; fluids_l: number | null
  cabin_pressure_kpa: number | null; ventilation_ms: number | null; cabin_o2_pct: number | null
  glucose_mgdl: number | null; bmr_ratio: number | null; body_fat_pct: number | null; calories_pct: number | null
  sodium_mg: number | null; calcium_mg: number | null; vitamin_d_iu: number | null; caffeine_mg: number | null
  hemoglobin_gdl: number | null; lean_mass_change_pct: number | null
  bone_tscore: number | null; bone_monthly_loss_pct: number | null
  manual_measurements: Record<string, unknown> | null
  simulated_data: Record<string, unknown> | null
}

/** records: pruebas manuales, una fila por usuario y día. */
export interface RecordRow {
  id: number; user_id: string; date: string; env: string | null
  tlx: number | null; pvt: number | null; pvt_max: number | null; fs: number
  amsler: 'green' | 'yellow' | 'red' | null; perfusion_s: number | null
  med_taken_pct: number | null; med_double_dose: boolean | null
  ortho_hr_rise: number | null; ortho_sys_drop: number | null; ortho_dia_drop: number | null
  ortho_symptoms: 'none' | 'dizzy' | 'presyncope' | 'syncope' | null
  who5: number | null; created_at: string
}

/** Vista daily_sensor (la consulta Interfaz/report-source.js). */
export interface DailySensorRow {
  user_id: string; date: string
  hr_avg: number | null; hr_max: number | null; temp_avg: number | null; spo2_min: number | null
  rad_msv: number | null; co2_max: number | null; rmssd: number | null
}

export interface ProfileRow { id: string; username: string; mission: string; sex: 'male' | 'female'; sim_stress: number | null }
export interface ActiveEmergency { user_id: string; crew_name: string; score: number; last_updated_at: string }

/* ---------- Consultas ---------- */

export async function latestTelemetry(client: SupabaseClient, userId: string): Promise<TelemetryRow | null> {
  const { data, error } = await client.from('telemetry').select('*')
    .eq('user_id', userId).order('ts', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data as TelemetryRow | null
}

export async function dailySensor(client: SupabaseClient, userId: string): Promise<DailySensorRow[]> {
  const { data, error } = await client.from('daily_sensor').select('*').eq('user_id', userId).order('date')
  if (error) throw error
  return (data ?? []) as DailySensorRow[]
}

export async function manualRecords(client: SupabaseClient, userId: string, limit = 90): Promise<RecordRow[]> {
  const { data, error } = await client.from('records').select('*')
    .eq('user_id', userId).order('date', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as RecordRow[]
}

export async function activeEmergencies(client: SupabaseClient): Promise<ActiveEmergency[]> {
  const { data, error } = await client.rpc('get_active_health_emergencies')
  if (error) throw error
  return (data ?? []) as ActiveEmergency[]
}

/** Tripulación de una misión con su última lectura (equivale al antiguo renderCrew, sin DOM). */
export async function crewSnapshot(client: SupabaseClient, mission: string) {
  const { data, error } = await client.from('profiles').select('id,username,mission,sex,sim_stress')
    .eq('mission', mission).order('username')
  if (error) throw error
  const crew = (data ?? []) as ProfileRow[]
  return Promise.all(crew.map(async profile => ({ profile, last: await latestTelemetry(client, profile.id).catch(() => null) })))
}

/** Lecturas nuevas en vivo (Supabase Realtime). Devuelve la función para cancelar la suscripción. */
export function subscribeTelemetry(client: SupabaseClient, userId: string, onRow: (row: TelemetryRow) => void): () => void {
  const channel: RealtimeChannel = client.channel(`telemetry-${userId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'telemetry', filter: `user_id=eq.${userId}` },
      payload => onRow(payload.new as TelemetryRow))
    .subscribe()
  return () => { void client.removeChannel(channel) }
}