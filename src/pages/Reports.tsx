import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import {
  useDoctorProcedureReport,
  useHospitalProcedureReport,
} from '../lib/api'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { classNames } from '../lib/utils'

type Row = { label: string; sub: string; byProc: Record<string, number>; total: number }

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [mode, setMode] = useState<'hospital' | 'doctor'>('hospital')
  const hospitalReport = useHospitalProcedureReport()
  const doctorReport = useDoctorProcedureReport()

  const query = mode === 'hospital' ? hospitalReport : doctorReport

  const { procedures, rows, grandTotal } = useMemo(() => {
    const procSet = new Set<string>()
    const grouped = new Map<string, Row>()

    for (const r of (query.data ?? []) as Array<{
      volume: number
      procedure: { name: string } | null
      hospital?: { name: string; city: string } | null
      doctor?: { name: string; title: string } | null
    }>) {
      const procName = r.procedure?.name ?? '—'
      procSet.add(procName)
      const key =
        mode === 'hospital'
          ? r.hospital?.name ?? '—'
          : `${r.doctor?.title ?? ''} ${r.doctor?.name ?? '—'}`.trim()
      const sub = mode === 'hospital' ? r.hospital?.city ?? '' : ''
      const cur =
        grouped.get(key) ?? { label: key, sub, byProc: {}, total: 0 }
      cur.byProc[procName] = (cur.byProc[procName] ?? 0) + r.volume
      cur.total += r.volume
      grouped.set(key, cur)
    }

    const procedures = [...procSet].sort()
    const rows = [...grouped.values()].sort((a, b) => b.total - a.total)
    const grandTotal = rows.reduce((s, r) => s + r.total, 0)
    return { procedures, rows, grandTotal }
  }, [query.data, mode])

  function exportCsv() {
    const headers = [
      mode === 'hospital' ? 'בית חולים' : 'רופא',
      ...procedures,
      'סה״כ',
    ]
    const data = rows.map((r) => [
      r.label + (r.sub ? ` (${r.sub})` : ''),
      ...procedures.map((p) => r.byProc[p] ?? 0),
      r.total,
    ])
    downloadCsv(`דוח-כמויות-${mode === 'hospital' ? 'בתי-חולים' : 'רופאים'}.csv`, headers, data)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">דוח כמויות ניתוחים</h1>
          <p className="text-sm text-slate-400">
            סיכום כמויות מצטברות לפי הליך
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download size={16} />
          ייצוא ל-Excel (CSV)
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['hospital', 'doctor'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={classNames(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition',
              mode === m
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {m === 'hospital' ? 'לפי בית חולים' : 'לפי רופא'}
          </button>
        ))}
      </div>

      {query.isLoading && <Spinner />}
      {query.error && <ErrorState error={query.error} />}
      {query.data && rows.length === 0 && (
        <EmptyState
          title="אין נתוני כמויות"
          hint="הזן כמות ניתוחים בכרטיסי הרופאים או בהגדרות בתי החולים"
        />
      )}

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="p-3 text-right font-medium">
                  {mode === 'hospital' ? 'בית חולים' : 'רופא'}
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
                  <td className="p-3 text-slate-700">
                    {r.label}
                    {r.sub && (
                      <span className="mr-1 text-xs text-slate-400">{r.sub}</span>
                    )}
                  </td>
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
                    {rows.reduce((s, r) => s + (r.byProc[p] ?? 0), 0) || ''}
                  </td>
                ))}
                <td className="p-3 text-center">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
