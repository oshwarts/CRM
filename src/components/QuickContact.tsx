import { Mail, MessageCircle, Navigation, Phone } from 'lucide-react'
import { classNames } from '../lib/utils'

/** the number without an extension: "03-5551234 שלוחה 5" → "03-5551234" */
const mainNumber = (raw: string) => raw.split(/ext|x|שלוחה|שלו['׳]/i)[0]

/** Israeli numbers for wa.me: 0521234567 → 972521234567 (also +972 (0)52…, 00972…, a number with an extension) */
export function whatsappNumber(raw: string): string {
  let digits = mainNumber(raw).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('9720')) digits = `972${digits.slice(4)}`
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return `972${digits.slice(1)}`
  return digits
}

/** the value of a tel: link: digits (and a leading +) of the main number only — spaces, brackets and an extension are dropped */
export function telHref(raw: string): string {
  const main = mainNumber(raw).trim()
  const digits = main.replace(/\D/g, '')
  return digits ? `tel:${main.startsWith('+') ? '+' : ''}${digits}` : ''
}

/** big one-tap buttons: call, WhatsApp, e-mail, navigate — only the ones that have the data */
export function QuickContact({ phone, email, place, className }: { phone?: string | null; email?: string | null; place?: string | null; className?: string }) {
  const items = [
    telHref(phone ?? '') && { key: 'call', href: telHref(phone ?? ''), label: 'שיחה', icon: Phone, external: false },
    whatsappNumber(phone ?? '').length >= 7 && { key: 'wa', href: `https://wa.me/${whatsappNumber(phone ?? '')}`, label: 'וואטסאפ', icon: MessageCircle, external: true },
    email && { key: 'mail', href: `mailto:${email}`, label: 'מייל', icon: Mail, external: false },
    place && { key: 'nav', href: `https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`, label: 'ניווט', icon: Navigation, external: true },
  ].filter((x): x is { key: string; href: string; label: string; icon: typeof Phone; external: boolean } => !!x)
  if (items.length === 0) return null
  return (
    <div className={classNames('grid grid-cols-4 gap-2 sm:flex sm:flex-wrap', className)}>
      {items.map(({ key, href, label, icon: Icon, external }) => (
        <a
          key={key}
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100 sm:min-h-0 sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-sm"
        >
          <Icon size={18} />
          {label}
        </a>
      ))}
    </div>
  )
}
