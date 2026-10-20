import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpen, CalendarClock, CheckSquare, Pencil, Plus, Search, SlidersHorizontal, Swords, TrendingDown, UserPlus, X } from 'lucide-react'
import { useCompetitorIntel, useCompetitors, useHospitals, useMyHospitalIds, useSaveCompetitor } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { IntelChips, IntelFormModal, IntelPicture, taskFromIntel } from '../components/CompetitorSection'
import { CompetitorAnalysis } from '../components/CompetitorAnalysis'
import { TaskFormModal } from '../components/TaskFormModal'
import { EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { normalizeHe } from '../lib/contactMatch'
import { OUTCOME_LABELS, competitorAlerts, isStale, newActivity } from '../lib/competitors'
import type { CompetitorIntelRow } from '../lib/types'
import { classNames, daysUntil, formatDate, plusDaysISO } from '../lib/utils'

function Stat({ icon, value, label, tone, onClick }: { icon: React.ReactNode; value: number; label: string; tone?: 'amber' | 'red'; onClick?: () => void }) {
  const hot = value > 0 && tone
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'card flex min-h-[56px] items-center gap-2.5 p-2.5 text-right transition hover:shadow-pop sm:gap-3 sm:p-3',
        hot && tone === 'amber' && 'border-amber-300 bg-amber-50',
        hot && tone === 'red' && 'border-red-200 bg-red-50',
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 sm:h-10 sm:w-10">{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none text-brand-800">{value}</span>
        <span className="mt-1 block text-xs leading-tight text-slate-600">{label}</span>
      </span>
    </button>
  )
}

const daysChip = (days: number) => (days <= 30 ? 'border-red-200 bg-red-50 text-red-600' : days <= 90 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600')

/** competitor activity across the whole system: who is active where, what they offer, which contracts end, and how we do against them */
export default function Competitors() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const intel = useCompetitorIntel()
  const list = useCompetitors()
  const hospitals = useHospitals()
  const myHospitals = useMyHospitalIds()
  const saveCompetitor = useSaveCompetitor()
  const tab = params.get('tab') ?? 'records'
  const setTab = (t: string) => setParams(t === 'records' ? {} : { tab: t }, { replace: true })

  const [q, setQ] = useState('')
  const [competitor, setCompetitor] = useState('')
  const [hospital, setHospital] = useState('')
  const [outcome, setOutcome] = useState('')
  const [onlyStale, setOnlyStale] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CompetitorIntelRow | null>(null)
  const [taskFor, setTaskFor] = useState<CompetitorIntelRow | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')

  const all = intel.data ?? []
  const words = normalizeHe(q).split(' ').filter(Boolean)

  const filtered = useMemo(
    () =>
      all.filter((i) => {
        if (competitor && i.competitor !== competitor) return false
        if (hospital && i.hospital_id !== hospital) return false
        if (outcome && i.outcome !== outcome) return false
        if (onlyStale && !isStale(i)) return false
        if (from && i.intel_date < from) return false
        if (to && i.intel_date > to) return false
        if (!words.length) return true
        const hay = normalizeHe([i.competitor, i.product, i.offer, i.notes, i.tender_name, i.doctor?.name, i.hospital?.name].filter(Boolean).join(' '))
        return words.every((w) => hay.includes(w))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, competitor, hospital, outcome, onlyStale, from, to],
  )
  const panelFilters = [hospital, outcome, onlyStale, from, to].filter(Boolean).length
  const anyFilter = !!(competitor || panelFilters || q)
  const clearAll = () => {
    setCompetitor('')
    setHospital('')
    setOutcome('')
    setOnlyStale(false)
    setFrom('')
    setTo('')
    setQ('')
  }

  const summary = useMemo(() => {
    const m = new Map<string, { n: number; hospitals: Set<string>; doctors: Set<string>; products: Set<string>; last: string; won: number; lost: number }>()
    for (const i of all) {
      const e = m.get(i.competitor) ?? { n: 0, hospitals: new Set(), doctors: new Set(), products: new Set(), last: '', won: 0, lost: 0 }
      e.n++
      if (i.hospital_id) e.hospitals.add(i.hospital?.name ?? i.hospital_id)
      if (i.doctor_id) e.doctors.add(i.doctor?.name ?? i.doctor_id)
      if (i.product) e.products.add(i.product)
      if (i.intel_date > e.last) e.last = i.intel_date
      if (i.outcome === 'won') e.won++
      if (i.outcome === 'lost') e.lost++
      m.set(i.competitor, e)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [all])

  // the agent sees what concerns his hospitals; a manager sees everything
  const scope = isAdmin ? null : myHospitals
  const alerts = useMemo(() => competitorAlerts(all, scope, 90), [all, scope])
  const yearAlerts = useMemo(() => competitorAlerts(all, scope, 365), [all, scope])
  const recent = useMemo(() => newActivity(all, scope, user?.id), [all, scope, user?.id])
  const lost90 = all.filter((i) => i.outcome === 'lost' && i.intel_date >= plusDaysISO(-90)).length
  const stale = all.filter(isStale).length
  const unlisted = useMemo(() => {
    const names = new Set((list.data ?? []).map((c) => c.name.toLowerCase().trim()))
    return [...new Set(all.filter((i) => !i.competitor_id && i.competitor.trim() && !names.has(i.competitor.toLowerCase().trim())).map((i) => i.competitor.trim()))]
  }, [all, list.data])

  async function addCompetitor(name: string) {
    setNameError('')
    try {
      const c = await saveCompetitor.mutateAsync({ name, products: '', description: '', strengths: '', weaknesses: '', our_answer: '', reps: '', website: '', learn_topic_id: null, active: true, sort: 0 })
      setNewName('')
      navigate(`/competitors/${c.id}`)
    } catch (e) {
      setNameError(e instanceof Error && e.message.includes('duplicate') ? 'מתחרה בשם הזה כבר קיים' : 'ההוספה נכשלה')
    }
  }

  if (intel.isLoading) return <Spinner />
  if (intel.error && !intel.data) return <ErrorState error={intel.error} />

  const recordCard = (i: CompetitorIntelRow) => (
    <li key={i.id} className="card p-3">
      <p dir="auto" className="font-semibold text-slate-800">
        {i.competitor_id ? (
          <Link to={`/competitors/${i.competitor_id}`} className="inline-block min-h-[28px] hover:text-brand-600 hover:underline">
            {i.competitor}
          </Link>
        ) : (
          i.competitor
        )}
        {i.product && <span className="font-normal text-slate-500"> · {i.product}</span>}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatDate(i.intel_date)}
        {i.doctor && (
          <>
            {' · '}
            <Link to={`/doctors/${i.doctor.id}`} className="inline-block min-h-[28px] hover:underline">
              {i.doctor.title} {i.doctor.name}
            </Link>
          </>
        )}
        {i.hospital && ` · ${i.hospital.name}`}
      </p>
      <IntelChips i={i} />
      {i.offer && (
        <p dir="auto" className="mt-1.5 whitespace-pre-line text-sm text-slate-700">
          {i.offer}
        </p>
      )}
      {i.notes && (
        <p dir="auto" className="mt-0.5 whitespace-pre-line text-xs text-slate-500">
          {i.notes}
        </p>
      )}
      {i.image_paths?.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {i.image_paths.map((p) => (
            <IntelPicture key={p} path={p} />
          ))}
        </span>
      )}
      <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-1.5">
        <button className="btn-ghost text-sm text-brand-600" onClick={() => setEditing(i)}>
          <Pencil size={14} /> עריכה
        </button>
        <button className="btn-ghost text-sm text-brand-600" onClick={() => setTaskFor(i)}>
          <CheckSquare size={14} /> משימה מהרישום
        </button>
      </div>
    </li>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
              <Swords size={20} />
            </span>
            פעילות מתחרים
          </h1>
          <p className="text-sm text-slate-500">מי פעיל אצל איזה רופא ובית חולים, מה הוא מציע, ומתי אפשר להיכנס</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          רישום חדש
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Stat icon={<UserPlus size={18} />} value={recent.length} label="רישומים חדשים השבוע" onClick={() => { setTab('records'); setFrom(plusDaysISO(-7)); setShowFilters(true) }} />
        <Stat icon={<CalendarClock size={18} />} value={alerts.length} label="חוזים ומכרזים עד 90 יום" tone="amber" onClick={() => setTab('contracts')} />
        <Stat icon={<TrendingDown size={18} />} value={lost90} label="הפסדים ב-90 יום" tone="red" onClick={() => { setTab('records'); setOutcome('lost'); setShowFilters(true) }} />
        <Stat icon={<AlertTriangle size={18} />} value={stale} label="רישומים שלא עודכנו" onClick={() => { setTab('records'); setOnlyStale(true); setShowFilters(true) }} />
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="records">רישומים</Tab>
          <Tab id="contracts">חוזים ומכרזים</Tab>
          <Tab id="analysis">ניתוח ושוק</Tab>
          <Tab id="list">מתחרים</Tab>
        </TabList>

        <TabPanel id="records">
          {/* search + the filters behind one button */}
          <div className="flex items-center gap-2">
            <label className="relative block min-w-0 flex-1">
              <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" className="input !pr-10" placeholder="חיפוש: מתחרה, מוצר, רופא, בית חולים" aria-label="חיפוש ברישומים" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button type="button" className={classNames('btn-secondary shrink-0', (showFilters || panelFilters > 0) && 'border-brand-400 text-brand-700')} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal size={16} />
              סינון
              {panelFilters > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-xs text-white">{panelFilters}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              <label className="col-span-2 flex flex-col gap-1 text-xs text-slate-600 sm:col-span-2">
                בית חולים
                <select className="input text-sm" value={hospital} onChange={(e) => setHospital(e.target.value)}>
                  <option value="">כל בתי החולים</option>
                  {(hospitals.data ?? [])
                    .filter((h) => all.some((i) => i.hospital_id === h.id))
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs text-slate-600 sm:col-span-2">
                תוצאה
                <select className="input text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="">כל התוצאות</option>
                  {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                מתאריך
                <input type="date" className="input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                עד תאריך
                <input type="date" className="input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <label className="col-span-2 flex min-h-8 items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-5 w-5" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} /> רק רישומים ישנים (מעל 90 יום)
              </label>
            </div>
          )}

          {/* competitor quick filter on the phone; the full table on a wide screen */}
          {summary.length > 1 && (
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" role="group" aria-label="סינון לפי מתחרה">
              {summary.map(([name, e]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={competitor === name}
                  onClick={() => setCompetitor(competitor === name ? '' : name)}
                  className={classNames('chip shrink-0 whitespace-nowrap', competitor === name ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700')}
                >
                  {name} · {e.n}
                </button>
              ))}
            </div>
          )}
          {summary.length > 0 && (
            <div tabIndex={0} aria-label="סיכום לפי מתחרה" className="card hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-right text-slate-500">
                    <th className="p-2.5 font-medium">מתחרה</th>
                    <th className="p-2.5 font-medium">רישומים</th>
                    <th className="p-2.5 font-medium">בתי חולים</th>
                    <th className="p-2.5 font-medium">רופאים</th>
                    <th className="p-2.5 font-medium">ניצחנו / הפסדנו</th>
                    <th className="p-2.5 font-medium">מוצרים</th>
                    <th className="p-2.5 font-medium">עדכון אחרון</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(([name, e]) => (
                    <tr key={name} className={classNames('cursor-pointer border-b border-slate-100 hover:bg-slate-50', competitor === name && 'bg-brand-50')} onClick={() => setCompetitor(competitor === name ? '' : name)}>
                      <td className="p-2.5 font-medium text-slate-800">{name}</td>
                      <td className="p-2.5">{e.n}</td>
                      <td className="p-2.5">{e.hospitals.size}</td>
                      <td className="p-2.5">{e.doctors.size}</td>
                      <td className="p-2.5">
                        <span className="text-emerald-700">{e.won}</span> / <span className="text-red-600">{e.lost}</span>
                      </td>
                      <td className="p-2.5 text-slate-500">{[...e.products].join(', ') || '—'}</td>
                      <td className="p-2.5 text-slate-500">{formatDate(e.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
            <p>
              {anyFilter ? `${filtered.length} מתוך ${all.length} רישומים` : `${all.length} רישומים`}
              {competitor && <span className="font-medium text-slate-800"> · {competitor}</span>}
            </p>
            {anyFilter && (
              <button className="btn-ghost text-sm text-brand-600" onClick={clearAll}>
                <X size={14} /> נקה סינון
              </button>
            )}
          </div>

          {filtered.length === 0 ? <EmptyState title="אין רישומים" hint={anyFilter ? 'אין רישומים שמתאימים לסינון — נסה לנקות אותו' : 'תעד פעילות של מתחרים מכרטיס רופא, מבית חולים או מכאן'} /> : <ul className="space-y-2">{filtered.map(recordCard)}</ul>}
        </TabPanel>

        <TabPanel id="contracts">
          <p className="text-sm text-slate-600">חוזים של מתחרים שמסתיימים ומכרזים שנסגרים — הרגע הנכון להגיע עם הצעה. {isAdmin ? 'מוצגים כל בתי החולים.' : myHospitals?.length ? 'מוצגים בתי החולים שבאחריותך.' : ''}</p>
          {yearAlerts.length === 0 ? (
            <EmptyState title="אין חוזים או מכרזים קרובים" hint='בעריכת רישום, תחת "פרטים נוספים", אפשר להזין מועד סיום חוזה או מכרז' />
          ) : (
            <ul className="space-y-2">
              {yearAlerts.map((a) => (
                <li key={a.key} className="card p-3">
                  <p dir="auto" className="font-semibold text-slate-800">
                    {a.kind === 'contract' ? 'סיום חוזה' : `מכרז: ${a.intel.tender_name}`} · {a.intel.competitor}
                    {a.intel.product && <span className="font-normal text-slate-500"> ({a.intel.product})</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.intel.hospital?.name ?? 'ללא בית חולים'}
                    {a.intel.doctor && ` · ${a.intel.doctor.title} ${a.intel.doctor.name}`}
                  </p>
                  {a.intel.notes && (
                    <p dir="auto" className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {a.intel.notes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className={classNames('chip', daysChip(a.days))}>
                      {formatDate(a.date)} · {a.days === 0 ? 'היום' : `בעוד ${a.days} ימים`}
                    </span>
                    <button className="btn-ghost text-sm text-brand-600" onClick={() => setTaskFor(a.intel)}>
                      <CheckSquare size={14} /> צור משימה
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel id="analysis">
          <CompetitorAnalysis />
        </TabPanel>

        <TabPanel id="list">
          {unlisted.length > 0 && isAdmin && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-1.5 font-medium">שמות שנכתבו ביד ואינם ברשימה — להוסיף?</p>
              <div className="flex flex-wrap gap-1.5">
                {unlisted.map((n) => (
                  <button key={n} className="chip border-amber-300 bg-white text-amber-800 hover:bg-amber-100" onClick={() => void addCompetitor(n)}>
                    <Plus size={12} /> {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="flex max-w-md gap-2">
              <input className="input" dir="auto" aria-label="שם מתחרה חדש" placeholder="מתחרה חדש" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newName.trim() && void addCompetitor(newName)} />
              <button className="btn-primary shrink-0" disabled={!newName.trim() || saveCompetitor.isPending} onClick={() => void addCompetitor(newName)}>
                <Plus size={16} /> הוסף
              </button>
            </div>
          )}
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          {(list.data ?? []).length === 0 ? (
            <EmptyState title="אין מתחרים ברשימה" hint={isAdmin ? 'הוסף מתחרה כדי לבחור אותו ברישומים' : 'מנהל מוסיף מתחרים לרשימה'} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {(list.data ?? []).map((c) => {
                const mine = all.filter((i) => i.competitor_id === c.id)
                const hosp = new Set(mine.map((i) => i.hospital_id).filter(Boolean))
                const nextEnd = mine.filter((i) => i.contract_end && i.contract_end >= plusDaysISO(0)).sort((a, b) => (a.contract_end ?? '').localeCompare(b.contract_end ?? ''))[0]
                return (
                  <li key={c.id}>
                    <Link to={`/competitors/${c.id}`} className={classNames('card block p-4 transition hover:shadow-pop', !c.active && 'opacity-60')}>
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                        {c.name}
                        {!c.active && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-500">לא פעיל</span>}
                        {c.learn_topic_id && <BookOpen size={14} className="text-brand-500" aria-label="יש נושא בלומדה" />}
                      </p>
                      <p dir="auto" className="text-xs text-slate-500">{c.products || 'ללא מוצרים רשומים'}</p>
                      <p className="mt-2 text-xs text-slate-600">
                        {mine.length} רישומים · {hosp.size} בתי חולים
                        {nextEnd?.contract_end && ` · חוזה הקרוב ${formatDate(nextEnd.contract_end)} (${daysUntil(nextEnd.contract_end)} ימים)`}
                      </p>
                      {c.our_answer && (
                        <p dir="auto" className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                          התשובה שלנו: {c.our_answer}
                        </p>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </TabPanel>
      </Tabs>

      {adding && <IntelFormModal onClose={() => setAdding(false)} />}
      {editing && <IntelFormModal intel={editing} onClose={() => setEditing(null)} />}
      {taskFor && <TaskFormModal onClose={() => setTaskFor(null)} defaults={taskFromIntel(taskFor)} />}
    </div>
  )
}
