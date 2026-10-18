import { useQuery } from '@tanstack/react-query'
import { infoStorage } from './largeFiles'
import type { InfoDocument } from './types'

export type DocText = { pages: string[] } | { unsupported: string }

const isPdf = (d: InfoDocument) => d.mime === 'application/pdf' || /\.pdf$/i.test(d.file_name)
const isText = (d: InfoDocument) => d.mime.startsWith('text/') || /\.(txt|md|csv)$/i.test(d.file_name)

/** the text of a stored document, read in the browser (nothing is sent anywhere) */
export async function readDocumentText(d: InfoDocument): Promise<DocText> {
  if (d.kind !== 'file' || !d.storage_path) return { unsupported: 'זה קישור חיצוני — אפשר לפתוח אותו בלבד' }
  if (!isPdf(d) && !isText(d)) return { unsupported: 'תצוגת קריאה זמינה לקבצי PDF וטקסט. את שאר הסוגים (Word, מצגות) אפשר לפתוח בקובץ המקורי' }
  const { data, error } = await infoStorage().download(d.storage_path)
  if (error || !data) throw new Error('לא ניתן להוריד את הקובץ')
  if (isText(d)) return { pages: [await data.text()] }
  const { getDocumentProxy, extractText } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(await data.arrayBuffer()))
  const { text } = await extractText(pdf, { mergePages: false })
  const pages = (Array.isArray(text) ? text : [text]).map((t) => t.replace(/\r/g, '').trim())
  if (pages.every((p) => p.length < 20)) return { unsupported: 'לא נמצא טקסט בקובץ (ייתכן שזה סריקה או תמונות). אפשר לפתוח את הקובץ המקורי' }
  return { pages }
}

export function useDocumentText(d: InfoDocument | null | undefined) {
  return useQuery({
    queryKey: ['doc-text', d?.id, d?.updated_at],
    enabled: !!d,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    queryFn: () => readDocumentText(d!),
  })
}

/** the whole text of a document as one string (for question generation) */
export const joinPages = (t: DocText): string => ('pages' in t ? t.pages.join('\n\n') : '')
