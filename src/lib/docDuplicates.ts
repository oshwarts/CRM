import type { InfoDocument } from './types'

/** SHA-256 of a file's content (hex), computed in the browser */
export async function fileHash(file: File): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** a name without extension, "copy" markers and punctuation — comparable between "JR101 guide (1).pdf" and "JR101-guide.PDF" */
export const normDocName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,5}$/, '')
    .replace(/\b(copy|final|v\d+)\b|עותק/g, ' ')
    .replace(/[_\-.()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokens = (s: string) => new Set(normDocName(s).split(' ').filter((w) => w.length >= 2))

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let common = 0
  for (const w of a) if (b.has(w)) common++
  return common / (a.size + b.size - common)
}

export type DupMatch = { doc: InfoDocument; reason: 'identical' | 'same-name' | 'similar' | 'same-link' }

const RANK = { identical: 0, 'same-link': 1, 'same-name': 2, similar: 3 } as const

/**
 * documents of the library that look like the one being added: the same content, the same name, or a very similar name
 * (also with the same size). `name` may be the file name and/or the title typed by the user.
 */
export function findSimilarDocs(input: { names: string[]; size?: number; hash?: string | null; url?: string }, docs: InfoDocument[]): DupMatch[] {
  const out: DupMatch[] = []
  const mine = input.names.filter(Boolean).map(normDocName).filter(Boolean)
  const mineTokens = input.names.filter(Boolean).map(tokens)
  for (const doc of docs) {
    let reason: DupMatch['reason'] | null = null
    if (input.hash && doc.content_hash && doc.content_hash === input.hash) reason = 'identical'
    else if (input.url && doc.kind === 'link' && doc.url.trim().replace(/\/$/, '') === input.url.trim().replace(/\/$/, '')) reason = 'same-link'
    else {
      const theirs = [doc.title, doc.file_name].filter(Boolean).map(normDocName).filter(Boolean)
      const theirTokens = [doc.title, doc.file_name].filter(Boolean).map(tokens)
      if (mine.some((m) => theirs.includes(m))) reason = 'same-name'
      else if (
        mine.some((m) => m.length >= 8 && theirs.some((t) => t.length >= 8 && (t.includes(m) || m.includes(t)))) ||
        mineTokens.some((a) => theirTokens.some((b) => jaccard(a, b) >= 0.7)) ||
        (input.size && doc.file_size === input.size && mineTokens.some((a) => theirTokens.some((b) => jaccard(a, b) >= 0.4)))
      )
        reason = 'similar'
    }
    if (reason) out.push({ doc, reason })
  }
  return out.sort((a, b) => RANK[a.reason] - RANK[b.reason]).slice(0, 4)
}

export const REASON_LABEL: Record<DupMatch['reason'], string> = {
  identical: 'אותו קובץ בדיוק',
  'same-link': 'אותו קישור',
  'same-name': 'אותו שם',
  similar: 'שם דומה',
}
