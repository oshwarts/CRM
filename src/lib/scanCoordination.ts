// Who to approach to coordinate a CT scan appointment. Public hospital: the agent works with the hospital's secretary.
// Private hospital: the agent hands the patient to the AMI secretary, who works with the imaging center (by contact, e-mail or a WhatsApp group).
import type { Contact, Hospital } from './types'

export const AMI_SECRETARY_KEY = 'scan.ami_secretary'

export type AmiSecretary = { name: string; phone: string; email: string }
export const NO_SECRETARY: AmiSecretary = { name: '', phone: '', email: '' }

export function parseSecretary(raw: string | null | undefined): AmiSecretary {
  try {
    const o = JSON.parse(raw || '{}') as Partial<AmiSecretary>
    return { name: String(o.name ?? '').trim(), phone: String(o.phone ?? '').trim(), email: String(o.email ?? '').trim() }
  } catch {
    return NO_SECRETARY
  }
}
export const stringifySecretary = (s: AmiSecretary) => JSON.stringify({ name: s.name.trim(), phone: s.phone.trim(), email: s.email.trim() })

export type ScanHospital = Pick<
  Hospital,
  'sector' | 'scan_contact_id' | 'scan_center_name' | 'scan_hours' | 'scan_notes' | 'scan_phone' | 'scan_email' | 'scan_whatsapp_name' | 'scan_whatsapp_url'
>

/** a private hospital is coordinated through AMI; anything else (public, or not set) directly with the hospital */
export const isPrivate = (h: Pick<Hospital, 'sector'> | null | undefined) => h?.sector === 'private'

/** only a WhatsApp link is opened from the text a person typed (never javascript: or another scheme) */
export function whatsappHref(url: string | null | undefined): string | null {
  const u = (url ?? '').trim()
  return /^https:\/\/(chat\.whatsapp\.com|wa\.me|api\.whatsapp\.com)\/\S+$/i.test(u) ? u : null
}

export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

/** the phone as a tel: link (digits and a leading +) */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

export type ScanRoute = {
  mode: 'public' | 'private'
  /** one sentence: what the agent does */
  instruction: string
  /** the person to approach first: the hospital's secretary (public) or the AMI secretary (private) */
  first: { name: string; role: string; phone: string; email: string } | null
  /** private: who the AMI secretary works with at the hospital */
  imaging: { center: string; contact: { name: string; role: string; phone: string } | null; email: string; whatsappName: string; whatsappUrl: string | null }
  hours: string
  notes: string
  /** nothing at all is set up yet */
  empty: boolean
}

export function scanRoute(h: ScanHospital | null | undefined, contacts: Pick<Contact, 'id' | 'name' | 'role' | 'phone' | 'email'>[], ami: AmiSecretary): ScanRoute {
  const contact = h?.scan_contact_id ? contacts.find((c) => c.id === h.scan_contact_id) ?? null : null
  const phone = (h?.scan_phone ?? '').trim() || contact?.phone || ''
  const email = (h?.scan_email ?? '').trim() || contact?.email || ''
  const hours = (h?.scan_hours ?? '').trim()
  const notes = (h?.scan_notes ?? '').trim()
  if (!isPrivate(h)) {
    return {
      mode: 'public',
      instruction: contact || phone || email ? 'לתאם ישירות מול המזכירה של בית החולים' : 'עוד לא הוגדרה מזכירה לתיאום — בחר איש קשר או הוסף טלפון',
      first: contact || phone || email ? { name: contact?.name ?? 'מזכירה', role: contact?.role ?? '', phone, email } : null,
      imaging: { center: '', contact: null, email: '', whatsappName: '', whatsappUrl: null },
      hours,
      notes,
      empty: !contact && !phone && !email && !hours && !notes,
    }
  }
  const hasAmi = !!(ami.name || ami.phone)
  const wa = whatsappHref(h?.scan_whatsapp_url)
  const imaging = {
    center: (h?.scan_center_name ?? '').trim(),
    contact: contact ? { name: contact.name, role: contact.role, phone } : phone ? { name: '', role: '', phone } : null,
    email,
    whatsappName: (h?.scan_whatsapp_name ?? '').trim(),
    whatsappUrl: wa,
  }
  return {
    mode: 'private',
    instruction: hasAmi ? 'להעביר את פרטי המטופל למזכירת אמי טכנולוגיות — היא מתאמת מול בית החולים' : 'להעביר למזכירת אמי טכנולוגיות (עוד לא הוגדרה — מנהל מגדיר בהגדרות)',
    first: hasAmi ? { name: ami.name || 'מזכירת אמי', role: 'מזכירת אמי טכנולוגיות', phone: ami.phone, email: ami.email } : null,
    imaging,
    hours,
    notes,
    empty: !hasAmi && !imaging.center && !imaging.contact && !imaging.email && !imaging.whatsappName && !wa && !hours && !notes,
  }
}
