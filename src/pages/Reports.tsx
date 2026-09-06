import { useMemo, useState } from 'react'
import { Download, PencilLine, Table2 } from 'lucide-react'
import { useAllCaseVolumes } from '../lib/api'
import { CaseVolumesManager } from '../components/CaseVolumesManager'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import type { CaseVolumeRow } from '../lib/types'
import { classNames } from '../lib/utils'

type GroupBy = 'hospital' | 'doctor' | 'company'

const GROUP_LABEL: Record<GroupBy, string> = {
  hospital: 'בית חולים',
  doctor: 'רופא',
  company: 'חברה',
}

function keyOf(r: CaseVolumeRow, by: GroupBy): string {
  if (by === 'hospital') return r.hospital?.name ?? '—'
  if (by === 'doctor')
    return `${r.doctor?.title ?? ''} ${r.doctor?.name ?? '—'}`.trim()
  return r.company?.name ?? 'ללא חברה'
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const volumes = useAllCaseVolumes()
  const [view, setView] = useState<'report' | 'edit'>('report')
  const [groupBy, setGroupBy] = useState<GroupBy>('hospital')
  const [year, setYear] = useState<string>('')

  const years = useMemo(() => {
    const s = new Set<number>()
    for (const r of volumes.data ?? []) s.add(r.year)
    return [...s].sort((a, b) => b - a)
  }, [volumes.data])

  const { procedures, rows, procTotals, grand } = useMemo(() => {
    const data = (volumes.data ?? []).filter(
      (r) => !year || String(r.year) === year,
    )
    const procSet = new Set<string>()
    const grouped = new Map<
      string,
      { label: string; byProc: Record<string, number>; total: number }
    >()
    for (const r of data) {
      const proc = r.procedure?.name ?? '—'
      procSet.add(proc)
      const k = keyOf(r, groupBy)
      const cur = grouped.get(k) ?? { label: k, byProc: {}, total: 0 }
      cur.byProc[proc] = (cur.byProc[proc] ?? 0) + r.count
      cur.total += r.count
      grouped.set(k, cur)
    }
    const procedures = [...procSet].sort()
    const rows = [...grouped.values()].sort((a, b) => b.total - a.total)
    const procTotals: Record<string, number> = {}
    for (const p of procedures)
      procTotals[p] = rows.reduce((s, r) => s + (r.byProc[p] ?? 0), 0)
    const grand = rows.reduce((s, r) => s + r.total, 0)
    return { procedures, rows, procTotals, grand }
  }, [volumes.data, groupBy, year])

  function exportCsv() {
    const headers = [GROUP_LABEL[groupBy], ...procedures, 'סה״כ']
    const body = rows.map((r) => [
      r.label,
      ...procedures.map((p) => r.byProc[p] ?? 0),
      r.total,
    ])
    body.push(['סה״כ', ...procedures.map((p) => procTotals[p]), grand])
    downloadCsv(
      `דוח-כמויות-${GROUP_LABEL[groupBy]}${year ? `-${year}` : ''}.csv`,
      headers,
      body,
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">כמויות מקרים</h1>
          <p className="text-sm text-slate-400">
            כל מקרה משויך לרופא ולבית חולים – הסכומים מתאזנים
          </p>
        </div>
        {view === 'report' && (
          <button
            className="btn-secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <Download size={16} />
            ייצוא ל-Excel (CSV)
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setView('report')}
          className={classNames(
            'flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-medium transition',
            view === 'report'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Table2 size={15} />
          דוח
        </button>
        <button
          onClick={() => setView('edit')}
          className={classNames(
            'flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-medium transition',
            view === 'edit'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <PencilLine size={15} />
          הוספה ועריכה
        </button>
      </div>

      {view === 'edit' && <CaseVolumesManager />}

      {view === 'report' && (
        <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={classNames(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition',
                groupBy === g
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              לפי {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
        <select
          className="input max-w-40"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">כל השנים</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {volumes.isLoading && <Spinner />}
      {volumes.error && <ErrorState error={volumes.error} />}
      {volumes.data && rows.length === 0 && (
        <EmptyState
          title="אין נתוני כמויות"
          hint="הזן כמויות מקרים כדי לראות את הדוח"
          action={
            <button className="btn-primary mt-2" onClick={() => setView('edit')}>
              <PencilLine size={16} />
              הוספה ועריכה
            </button>
          }
        />
      )}

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="p-3 text-right font-medium">
                  {GROUP_LABEL[groupBy]}
                </th>
                {procedures.map((p) => (
                  <th key={p} className="p-3 text-center font-medium">
                    {p}
                  </th>
                ))}
                <th className="p-3 text-center font-semibold">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-slate-100">
                  <td className="p-3 text-slate-700">{r.label}</td>
                  {procedures.map((p) => (
                    <td key={p} className="p-3 text-center text-slate-500">
                      {r.byProc[p] || ''}
                    </td>
                  ))}
                  <td className="p-3 text-center font-semibold text-slate-800">
                    {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-700">
                <td className="p-3">סה״כ</td>
                {procedures.map((p) => (
                  <td key={p} className="p-3 text-center">
                    {procTotals[p] || ''}
                  </td>
                ))}
                <td className="p-3 text-center">{grand}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  )
}
