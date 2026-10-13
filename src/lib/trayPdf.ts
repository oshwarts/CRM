// Reads an instrument-tray layout PDF (like "Mako Total Knee tray layouts"): every page that has a numbered
// parts list becomes one tray — name and the parts (number, catalog number, description).
// (The instrument photos inside such PDFs are JPEG2000, which cannot be drawn in the browser — pictures are added by upload.)
import type { EquipmentPartInput } from './api'

export type TrayDraft = {
  page: number
  name: string
  parts: EquipmentPartInput[]
}

// "1 110730 End effector array"  /  "4 164505-03 Spacer paddle 5 × 6mm (2)"
const PART = /^(\d{1,3})\s+([0-9A-Z][0-9A-Z.-]{3,})\s+(.+)$/
const TRAY_LABEL = /^(upper|lower|middle|top|bottom)\s+tray$/i
const SKIP = /^(description|mako\b.*layouts?|\d+(\s+\d+)*)$/i

/** "(2)" at the end of a description = quantity of that part */
function qtyOf(desc: string): { description: string; qty: number } {
  const m = desc.match(/^(.*?)\s*\((\d{1,2})\)$/)
  return m ? { description: m[1].trim(), qty: Number(m[2]) } : { description: desc.trim(), qty: 1 }
}

export function parseTrayPage(text: string): { title: string; kit: string; label: string; parts: EquipmentPartInput[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const title = lines[0] ?? ''
  const parts: EquipmentPartInput[] = []
  let kit = ''
  let label = ''
  for (const l of lines.slice(1)) {
    const m = l.match(PART)
    if (m) {
      const { description, qty } = qtyOf(m[3])
      parts.push({ position: Number(m[1]), catalog_no: m[2], description, qty })
    } else if (TRAY_LABEL.test(l)) label = l.replace(/^./, (c) => c.toUpperCase())
    else if (!kit && !SKIP.test(l)) kit = l
  }
  return { title, kit, label, parts }
}

export async function readTrayPdf(file: File, onProgress?: (msg: string) => void): Promise<TrayDraft[]> {
  const { getDocumentProxy, extractText } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
  const { text } = await extractText(pdf, { mergePages: false })
  const out: TrayDraft[] = []
  for (let i = 0; i < pdf.numPages; i++) {
    onProgress?.(`קורא עמוד ${i + 1} מתוך ${pdf.numPages}…`)
    const info = parseTrayPage(text[i] ?? '')
    if (info.parts.length === 0) continue
    const base = info.kit || info.title || `מגש ${i + 1}`
    out.push({ page: i + 1, name: info.label ? `${base} — ${info.label}` : base, parts: info.parts })
  }
  return out
}
