import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configError: string | null =
  !url || !anonKey
    ? 'חסרים משתני סביבה VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. יש להגדיר אותם ב-Vercel (Project → Settings → Environment Variables) עבור סביבת Production ולבצע Redeploy.'
    : null

export const supabase = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
)
