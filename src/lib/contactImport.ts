export type Candidate = { name: string; tels: string[]; emails: string[] }

type ContactsManager = {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>
}

const manager = (): ContactsManager | null =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window
    ? (navigator as unknown as { contacts: ContactsManager }).contacts
    : null

/** Android Chrome only — iOS Safari and desktop browsers do not expose the contact picker */
export const canPickContacts = () => manager() !== null

/** +972-50-123-4567 → 0501234567; anything else is only stripped of spaces/dashes */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '')
  const m = cleaned.match(/^\+?972(\d{8,9})$/)
  return m ? `0${m[1]}` : cleaned
}

const uniq = (a: string[]) => [...new Set(a.filter(Boolean))]

export async function pickFromDevice(): Promise<Candidate[]> {
  const m = manager()
  if (!m) return []
  const res = await m.select(['name', 'tel', 'email'], { multiple: false })
  return res.map((c) => ({
    name: c.name?.[0] ?? '',
    tels: uniq((c.tel ?? []).map(normalizePhone)),
    emails: uniq((c.email ?? []).map((e) => e.trim())),
  }))
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      for (const b of new TextEncoder().encode(s[i])) bytes.push(b)
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

const unescapeVcard = (v: string) => v.replace(/\\([,;n\\])/gi, (_m, c: string) => (c.toLowerCase() === 'n' ? ' ' : c))

/** parses a .vcf file (one or many cards) as exported by Outlook, Gmail and iOS/Android contacts */
export function parseVcard(text: string): Candidate[] {
  // unfold continuation lines (and quoted-printable soft breaks)
  const raw = text.replace(/\r\n|\r/g, '\n').replace(/=\n/g, '').replace(/\n[ \t]/g, '')
  const out: Candidate[] = []
  for (const card of raw.split(/BEGIN:VCARD/i).slice(1)) {
    const body = card.split(/END:VCARD/i)[0]
    let fn = ''
    let n = ''
    const tels: string[] = []
    const emails: string[] = []
    for (const line of body.split('\n')) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const head = line.slice(0, idx).toUpperCase()
      let value = line.slice(idx + 1).trim()
      if (head.includes('QUOTED-PRINTABLE')) value = decodeQuotedPrintable(value)
      const prop = head.split(';')[0].replace(/^[A-Z0-9-]+\./, '')
      if (prop === 'FN') fn = unescapeVcard(value)
      else if (prop === 'N') {
        const [family = '', given = ''] = value.split(';')
        n = `${given} ${family}`.trim()
      } else if (prop === 'TEL') tels.push(normalizePhone(value.replace(/^tel:/i, '')))
      else if (prop === 'EMAIL') emails.push(value.replace(/^mailto:/i, ''))
    }
    const name = fn || n
    if (name || tels.length || emails.length)
      out.push({ name, tels: uniq(tels), emails: uniq(emails) })
  }
  return out
}
