import { normalizeHe } from './contactMatch'

export type QRecord = {
  id: string
  name: string
  phone: string
  email: string
  /** a second phone (office) — contacts only */
  office_phone?: string
  hospital_id?: string | null
  doctor_id?: string | null
  detail?: string
}

const TITLES = new Set(['דר', 'ד״ר', 'פרופ', 'פרופסור', 'דוקטור', 'prof', 'dr'])

/** a name without titles, as a comparable string */
export const nameKey = (name: string) =>
  normalizeHe(name)
    .split(' ')
    .filter((w) => w && !TITLES.has(w))
    .join(' ')

/** the last 9 digits of a phone (so +972-50… and 050… match); too short numbers do not count */
export const phoneKey = (p: string | undefined) => {
  const d = (p ?? '').replace(/\D/g, '')
  return d.length >= 7 ? d.slice(-9) : ''
}

/** groups of records that look like the same thing (same name, phone or email), found with union-find */
export function findDuplicates(list: QRecord[], opts: { byContactLink?: boolean } = {}): QRecord[][] {
  const parent = new Map(list.map((r) => [r.id, r.id]))
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  const bucket = (key: (r: QRecord) => string, accept?: (a: QRecord, b: QRecord) => boolean) => {
    const seen = new Map<string, QRecord[]>()
    for (const r of list) {
      const k = key(r)
      if (!k) continue
      for (const o of seen.get(k) ?? []) if (!accept || accept(o, r)) union(o.id, r.id)
      seen.set(k, [...(seen.get(k) ?? []), r])
    }
  }
  // contacts with the same name are one person only when they belong to the same place (or one of them has none)
  const samePlace = (a: QRecord, b: QRecord) =>
    !opts.byContactLink || !a.hospital_id || !b.hospital_id || a.hospital_id === b.hospital_id || (!!a.doctor_id && a.doctor_id === b.doctor_id)
  bucket((r) => nameKey(r.name), samePlace)
  // a shared phone or e-mail (a clinic line, a switchboard) only counts when the names also have a word in common
  const shareWord = (a: QRecord, b: QRecord) => {
    const wa = new Set(nameKey(a.name).split(' ').filter((w) => w.length >= 2))
    return nameKey(b.name).split(' ').some((w) => wa.has(w))
  }
  bucket((r) => phoneKey(r.phone), shareWord)
  bucket((r) => phoneKey(r.office_phone), shareWord)
  bucket((r) => (r.email ?? '').trim().toLowerCase(), shareWord)
  const groups = new Map<string, QRecord[]>()
  for (const r of list) groups.set(find(r.id), [...(groups.get(find(r.id)) ?? []), r])
  return [...groups.values()].filter((g) => g.length > 1)
}
