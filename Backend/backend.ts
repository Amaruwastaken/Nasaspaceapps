import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_PUBLISHABLE_KEY')
)
