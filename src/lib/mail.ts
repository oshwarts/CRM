// Outlook / Windows drop mailto links longer than ~2000 characters
const MAILTO_LIMIT = 1900

/** returns 'full' when the whole list went into the draft, 'copied' when it was too long */
export function buildMailto(
  to: string,
  subject: string,
  body: string,
  pasteNote = 'שלום,\n\nהתוכן המלא הועתק — הדבק אותו כאן (הדבקה / Ctrl+V).',
): { url: string; mode: 'full' | 'copied' } {
  const make = (b: string) =>
    `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b).replace(/%0A/g, '%0D%0A')}`
  const full = make(body)
  if (full.length <= MAILTO_LIMIT) return { url: full, mode: 'full' }
  return { url: make(pasteNote), mode: 'copied' }
}


/** compose window of Outlook on the web (Microsoft 365) — works without any mail app installed */
export function buildOutlookWebUrl(to: string, subject: string, body: string): string {
  const q = (s: string) => encodeURIComponent(s).replace(/%0A/g, '%0D%0A')
  return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${q(subject)}&body=${q(body)}`
}

const OUTLOOK_LIMIT = 6500

/** both ways of opening a draft; 'copied' means the body was too long and has to be pasted */
export function composeMail(to: string, subject: string, body: string) {
  const mailto = buildMailto(to, subject, body)
  const full = buildOutlookWebUrl(to, subject, body)
  const outlook =
    full.length <= OUTLOOK_LIMIT
      ? { url: full, mode: 'full' as const }
      : {
          url: buildOutlookWebUrl(to, subject, 'שלום,\n\nהתוכן המלא הועתק — הדבק אותו כאן (הדבקה / Ctrl+V).'),
          mode: 'copied' as const,
        }
  return { mailto, outlook }
}
