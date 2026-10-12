// Maps a folder structure like  Data/Knee/Mako/xxx.pdf  to a procedure and a category.

export const ALLOWED_EXT = /\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|webp|mp4)$/i

export type Proc = { id: string; name: string }
export type Cat = { id: string; name: string }

/** joint + approach written in the folder names → the matching procedure of the system */
export function guessProcedure(folders: string[], procedures: Proc[]): string {
  const t = folders.join(' ').toLowerCase()
  const hip = /hip|ירך/.test(t)
  const knee = /knee|ברך/.test(t)
  const mako = /mako|robot|רובוט|מאקו/.test(t)
  const manual = /manual|ידני|conventional|קונבנציונל/.test(t)
  const uni = /uni\b|unicomp|partial|יוני|חלקית/.test(t)
  const revision = /revision|רוויזי/.test(t)
  const byName = (re: RegExp) => procedures.find((p) => re.test(p.name))?.id ?? ''

  if (revision) return byName(hip ? /רוויזיית ירך/ : /רוויזיית ברך/)
  if (knee && uni) return byName(/חלקית|יוני/)
  if (hip && mako) return byName(/ירך.*MAKO|MAKO.*ירך/i)
  if (hip && manual) return byName(/ירך ידנית/)
  if (knee && mako) return procedures.find((p) => /ברך/.test(p.name) && /MAKO/i.test(p.name) && !/חלקית|יוני/.test(p.name))?.id ?? ''
  if (knee && manual) return byName(/ברך ידנית/)
  return ''
}

/** category from the file name (the user can still change it before uploading) */
export function guessCategory(fileName: string, cats: Cat[]): string {
  const n = fileName.toLowerCase()
  const find = (re: RegExp) => cats.find((c) => re.test(c.name))?.id ?? ''
  if (/technique|טכניקה/.test(n)) return find(/technique/i)
  if (/protocol|פרוטוקול/.test(n)) return find(/protocol/i)
  if (/study|studies|paper|clinical|outcome|מחקר|מאמר/.test(n)) return find(/מחקר/)
  if (/catalog|catalogue|brochure|ordering|קטלוג/.test(n)) return find(/קטלוג/)
  if (/\.pptx?$/.test(n)) return find(/מצגות/)
  if (/guide|training|manual/.test(n)) return find(/technique/i)
  return ''
}

export const titleOf = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()

export async function sha256(file: File): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
