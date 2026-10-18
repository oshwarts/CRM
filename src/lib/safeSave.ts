// A save that does not overwrite what somebody else changed in the meantime.
// A form used to write every field of a record: two people editing different fields of the same doctor at the same time meant that
// the one who saved last silently put back the old values of the other. Now only the fields this person changed are written, and
// when somebody else changed one of the same fields since the form was opened, the person is asked before overwriting it.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const db = supabase as unknown as SupabaseClient
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export type SafeSaveResult = { changed: string[]; overwritten: string[] }

export async function saveChangedFields(opts: {
  table: string
  id: string
  /** the values the form was opened with */
  base: Record<string, unknown>
  /** the values now in the form */
  next: Record<string, unknown>
  /** Hebrew names of the fields, for the question about a conflict */
  labels?: Record<string, string>
}): Promise<SafeSaveResult> {
  const { table, id, base, next, labels = {} } = opts
  const changed = Object.keys(next).filter((k) => !same(base[k], next[k]))
  if (changed.length === 0) return { changed: [], overwritten: [] }
  const patch = Object.fromEntries(changed.map((k) => [k, next[k]]))
  let overwritten: string[] = []

  // up to two tries: the second one when the record changed between reading it and writing
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: cur, error } = await db.from(table).select([...changed, 'updated_at'].join(',')).eq('id', id).single()
    if (error) throw error
    const row = cur as unknown as Record<string, unknown>
    // a field somebody else changed to something else than what this person typed
    overwritten = changed.filter((k) => !same(row[k], base[k]) && !same(row[k], next[k]))
    if (overwritten.length > 0 && attempt === 0) {
      const names = overwritten.map((k) => labels[k] ?? k).join(', ')
      if (!window.confirm(`מישהו אחר שינה בינתיים את: ${names}.\nלדרוס את השינוי שלו בערכים שהקלדת?\n\n"אישור" — לדרוס, "ביטול" — לא לשמור (תוכל לטעון את הרשומה מחדש ולהתחיל שוב).`)) throw new Error('השמירה בוטלה — הרשומה שונתה על ידי מישהו אחר')
    }
    const { data: done, error: werr } = await db.from(table).update(patch).eq('id', id).eq('updated_at', row.updated_at as string).select('id')
    if (werr) throw werr
    if ((done ?? []).length > 0) return { changed, overwritten }
  }
  // the record kept changing: write without the guard rather than lose the person's work
  const { error } = await db.from(table).update(patch).eq('id', id)
  if (error) throw error
  return { changed, overwritten }
}
