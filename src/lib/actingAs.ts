import { supabase } from './supabase'

// The user the app acts as: the signed-in user, or — for the developer account while it is switched to another
// user — that user. The database decides the same thing in effective_uid() (migration 035).
let acting: string | null = null

export function setActingId(id: string | null) {
  acting = id
}

export async function actingUserId(): Promise<string | null> {
  if (acting) return acting
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
