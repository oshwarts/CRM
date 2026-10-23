import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { useDoctors, useHospitals } from '../lib/api'
import { useInvestigations, type InvestigationDraft } from '../lib/investigations'
import { CATEGORIES, filterInvestigations, investigationStats, noFilters, SEVERITY_LABELS, sortInvestigations, type InvFilters } from '../lib/investigationLogic'
import { blankInvestigation, draftOf, InvestigationCard, InvestigationForm } from '../components/InvestigationsSection'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { classNames, todayISO } from '../lib/utils'

/** all investigations in one place: what is open, what is late, who and where it concerns, and the root causes that repeat */
export default function Investigations() {
  const list = useInvestigations()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const [f, setF] = useState<InvFilters>(noFilters)
  const [draft, setDraft] = useState<InvestigationDraft | null>(null)
  const today = todayISO()
  const patch = (p: Partial<InvFilters>) => setF((x) => ({ ...x, ...p }))

  const all = useMemo(() => list.data ?? [], [list.data])
  const stats = useMemo(() => investigationStats(all, today), [all, today])
  const shown = useMemo(() => sortInvestigations(filterInvestigations(all, f, today)), [all, f, today])
  const involved = useMemo(() => {
    const ids = new Set(all.flatMap((i) => i.doctors.map((d) => d.id)))
    return (doctors.data ?? []).filter((d) => ids.has(d.id))
  }, [all, doctors.data])

  if (list.isLoading) return <Spinner />
  if (list.error && !list.data) return <ErrorState error={list.error} />

  const stat = (label: string, value: number, tone = '') => (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={classNames('font-semibold', tone)}>{value}</p>
    </div>
  )
  const statusBtn = (k: InvFilters['status'], label: string, n: number) => (
    <button key={k} type="button" role="radio" aria-checked={f.status === k} onClick={() => patch({ status: k })} className={classNames('min-h-[44px] rounded-lg px-2 text-sm font-medium', f.status === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600')}>
      {label} <span className="text-xs text-slate-500">{n}</span>
    </button>
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/doctors" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            <ArrowRight size={14} aria-hidden /> לרופאים
          </Link>
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">תחקירים</h1>
          <p className="text-sm text-slate-500">כל התחקירים במקום אחד: מה פתוח, מה מתעכב, ואילו סיבות חוזרות</p>
        </div>
        <button className="btn-primary" onClick={() => setDraft(blankInvestigation())}>
          <Plus size={16} aria-hidden /> תחקיר חדש
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {stat('פתוחים', stats.open)}
        {stat(`מתעכבים (מעל 14 ימים)`, stats.late, stats.late ? 'text-amber-700' : '')}
        {stat('חומרה גבוהה, פתוחים', stats.high, stats.high ? 'text-red-700' : '')}
        {stat('נסגרו', stats.closed)}
      </div>

      {stats.byCategory.length > 0 && (
        <section aria-label="סיבות חוזרות" className="rounded-2xl border border-slate-200 bg-white p-3">
          <h2 className="mb-1.5 text-xs font-semibold text-slate-500">סיבות שורש שחוזרות</h2>
          <ul className="flex flex-wrap gap-1.5">
            {stats.byCategory.map((c) => (
              <li key={c.category}>
                <button type="button" aria-pressed={f.category === c.category} onClick={() => patch({ category: f.category === c.category ? '' : c.category, status: 'all' })} className={classNames('min-h-[36px] rounded-full border px-3 text-sm', f.category === c.category ? 'border-violet-500 bg-violet-500 text-white' : 'border-violet-200 bg-violet-50 text-violet-800')}>
                  {c.category} · {c.count}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="radiogroup" aria-label="סטטוס" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:max-w-md">
        {statusBtn('open', 'פתוחים', stats.open)}
        {statusBtn('closed', 'נסגרו', stats.closed)}
        {statusBtn('all', 'הכל', stats.open + stats.closed)}
      </div>

      <div className="flex flex-wrap gap-2">
        <input type="search" className="input !w-full sm:!w-64" aria-label="חיפוש בתחקירים" placeholder="חיפוש: כותרת, אדם, מוצר…" value={f.q} onChange={(e) => patch({ q: e.target.value })} />
        <select className="input !w-full sm:!w-auto" aria-label="רופא" value={f.doctorId} onChange={(e) => patch({ doctorId: e.target.value })}>
          <option value="">כל הרופאים</option>
          {involved.map((d) => (
            <option key={d.id} value={d.id}>{d.title} {d.name}</option>
          ))}
        </select>
        <select className="input !w-full sm:!w-auto" aria-label="בית חולים" value={f.hospitalId} onChange={(e) => patch({ hospitalId: e.target.value })}>
          <option value="">כל בתי החולים</option>
          {(hospitals.data ?? []).map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <select className="input !w-full sm:!w-auto" aria-label="סוג שורש" value={f.category} onChange={(e) => patch({ category: e.target.value })}>
          <option value="">כל הסוגים</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="input !w-full sm:!w-auto" aria-label="חומרה" value={f.severity} onChange={(e) => patch({ severity: Number(e.target.value) })}>
          <option value={0}>כל החומרות</option>
          {[3, 2, 1].map((n) => (
            <option key={n} value={n}>חומרה {SEVERITY_LABELS[n]}</option>
          ))}
        </select>
        <button type="button" aria-pressed={f.lateOnly} onClick={() => patch({ lateOnly: !f.lateOnly })} className={classNames('min-h-[44px] rounded-xl border px-3 text-sm font-medium', f.lateOnly ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600')}>
          מתעכבים בלבד
        </button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? 'עדיין אין תחקירים' : 'אין תחקירים בסינון הזה'}
          hint={all.length === 0 ? 'תחקיר מתעד בעיה, את שורש הבעיה ואת הפתרון' : 'נסה לנקות את הסינון'}
          action={all.length > 0 ? <button className="btn-secondary" onClick={() => setF(noFilters)}>נקה סינון</button> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {shown.slice(0, 100).map((i) => (
            <InvestigationCard key={i.id} i={i} onEdit={(x) => setDraft(draftOf(x))} />
          ))}
        </ul>
      )}
      {shown.length > 100 && <p className="text-xs text-slate-500">מוצגים 100 מתוך {shown.length}. צמצם בעזרת החיפוש או הסינון.</p>}
      {draft && <InvestigationForm draft={draft} onClose={() => setDraft(null)} />}
    </div>
  )
}
