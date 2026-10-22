// The picking list of a doctor: from the equipment plan of each procedure and the number of surgeries, what to send.

export type PickingLine = { procedure_id: string; count: number }
export type PickingRow = {
  procedure_id: string
  item_id: string
  qty_per_case: number
  scales_with_cases: boolean
  item: { name: string; catalog_number: string; company?: { name: string } | null } | null
}
export type PickingTotal = { itemId: string; name: string; catalog: string; company: string; total: number; detail: string[] }

/** per item (the same item in two procedures is one line): a "per case" item grows with the surgeries, a fixed one (an instrument tray) is sent once per kind of surgery, however many lines name that surgery */
export function pickingTotals(rows: PickingRow[], lines: PickingLine[]): PickingTotal[] {
  const map = new Map<string, PickingTotal>()
  const fixedSeen = new Set<string>()
  for (const line of lines) {
    if (!line.procedure_id || !(line.count > 0)) continue
    for (const r of rows) {
      if (r.procedure_id !== line.procedure_id || !r.item) continue
      const fixedKey = `${r.procedure_id}:${r.item_id}`
      if (!r.scales_with_cases && fixedSeen.has(fixedKey)) continue
      if (!r.scales_with_cases) fixedSeen.add(fixedKey)
      const cur = map.get(r.item_id) ?? { itemId: r.item_id, name: r.item.name, catalog: r.item.catalog_number, company: r.item.company?.name ?? '', total: 0, detail: [] }
      cur.total += r.scales_with_cases ? r.qty_per_case * line.count : r.qty_per_case
      cur.detail.push(r.scales_with_cases ? `${r.qty_per_case}×${line.count}` : `${r.qty_per_case} (קבוע)`)
      map.set(r.item_id, cur)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'))
}
