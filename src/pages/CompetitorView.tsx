import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ExternalLink, Pencil, Plus, Swords } from 'lucide-react'
import { useCompetitorIntel, useCompetitors, useDeleteCompetitor, useSaveCompetitor, type CompetitorInput } from '../lib/api'
import { useLearnTopics } from '../lib/learnApi'
import { useAuth } from '../context/AuthProvider'
import { RobotLinks } from '../components/RobotLinks'
import { IntelChips, IntelFormModal, IntelPicture } from '../components/CompetitorSection'
import { ConfirmButton, EmptyState, Field, Modal, Spinner } from '../components/ui'
import { LOYALTY_LABELS, LOYALTY_TONE } from '../lib/competitors'
import { classNames, formatDate } from '../lib/utils'

const blank = (c: { [K in keyof CompetitorInput]?: CompetitorInput[K] }): CompetitorInput => ({
  name: c.name ?? '',
  products: c.products ?? '',
  description: c.description ?? '',
  strengths: c.strengths ?? '',
  weaknesses: c.weaknesses ?? '',
  our_answer: c.our_answer ?? '',
  reps: c.reps ?? '',
  website: c.website ?? '',
  learn_topic_id: c.learn_topic_id ?? null,
  active: c.active ?? true,
  sort: c.sort ?? 0,
})

/** the card of one competitor: a read-only battlecard (what we answer, their strengths and weaknesses) with an edit action for managers, then where they are active and everything recorded about them */
export default function CompetitorView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const competitors = useCompetitors()
  const intel = useCompetitorIntel()
  const topics = useLearnTopics()
  const save = useSaveCompetitor()
  const del = useDeleteCompetitor()
  const c = (competitors.data ?? []).find((x) => x.id === id)
  const [form, setForm] = useState<CompetitorInput | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (c) setForm(blank(c))
  }, [c?.id, c?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => (intel.data ?? []).filter((i) => i.competitor_id === id), [intel.data, id])
  const hospitals = useMemo(() => {
    const m = new Map<string, { name: string; n: number; last: string }>()
    for (const i of mine) {
      if (!i.hospital) continue
      const e = m.get(i.hospital.id) ?? { name: i.hospital.name, n: 0, last: '' }
      e.n++
      if (i.intel_date > e.last) e.last = i.intel_date
      m.set(i.hospital.id, e)
    }
    return [...m.values()].sort((a, b) => b.n - a.n)
  }, [mine])
  const doctors = useMemo(() => {
    const m = new Map<string, { id: string; name: string; loyalty: string; date: string }>()
    for (const i of mine) {
      if (!i.doctor) continue
      const e = m.get(i.doctor.id)
      if (!e || i.intel_date > e.date) m.set(i.doctor.id, { id: i.doctor.id, name: `${i.doctor.title} ${i.doctor.name}`.trim(), loyalty: i.loyalty || e?.loyalty || '', date: i.intel_date })
    }
    return [...m.values()]
  }, [mine])

  if (competitors.isLoading) return <Spinner />
  if (!c || !form) return <EmptyState title="המתחרה לא נמצא" action={<Link to="/competitors?tab=list" className="btn-secondary mt-2">לרשימת המתחרים</Link>} />
  const set = (p: Partial<CompetitorInput>) => setForm((f) => (f ? { ...f, ...p } : f))
  const topic = (topics.data ?? []).find((t) => t.id === c.learn_topic_id)

  async function submit() {
    if (!form) return
    setMsg('')
    try {
      await save.mutateAsync({ ...form, id: c!.id })
      setEditing(false)
    } catch (e) {
      setMsg(e instanceof Error && e.message.includes('duplicate') ? 'מתחרה בשם הזה כבר קיים' : 'השמירה נכשלה')
    }
  }

  const readBlock = (label: string, value: string, tone = 'border-slate-200 bg-white') =>
    value.trim() ? (
      <div className={classNames('rounded-xl border p-3', tone)}>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">{label}</h2>
        <p dir="auto" className="whitespace-pre-line text-sm text-slate-800">
          {value}
        </p>
      </div>
    ) : null
  const area = (label: string, key: 'description' | 'strengths' | 'weaknesses' | 'our_answer' | 'reps', hint?: string) => (
    <Field label={label}>
      <textarea className="input min-h-20" dir="auto" placeholder={hint} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  )
  const hasCard = [c.description, c.strengths, c.weaknesses, c.our_answer, c.reps].some((x) => x.trim())
  const productList = c.products.split(',').map((x) => x.trim()).filter(Boolean)
  const site = c.website && /^https?:\/\//i.test(c.website) ? c.website : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 dir="auto" className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
              <Swords size={20} />
            </span>
            {c.name}
            {!c.active && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-sm font-normal text-slate-500">לא פעיל</span>}
          </h1>
          {productList.length > 0 ? (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {productList.map((x) => (
                <span key={x} className="chip border-slate-200 bg-slate-50 !py-0.5 text-slate-700">
                  {x}
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">ללא מוצרים רשומים</p>
          )}
          <div className="mt-1.5">
            <RobotLinks kind="competitor" ownerId={c.id} editable={isAdmin} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> רישום חדש
          </button>
          {isAdmin && (
            <button
              className="btn-secondary"
              onClick={() => {
                setForm(blank(c))
                setMsg('')
                setEditing(true)
              }}
            >
              <Pencil size={15} /> עריכת הכרטיס
            </button>
          )}
        </div>
      </div>

      {/* the battlecard: what to say first, then strengths and weaknesses, then the background */}
      <section className="space-y-3" aria-label="כרטיס מתחרה">
        {readBlock('מה אנחנו עונים', c.our_answer, 'border-brand-300 bg-brand-50')}
        {(c.strengths.trim() || c.weaknesses.trim()) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {readBlock('חוזקות שלהם', c.strengths, 'border-amber-200 bg-amber-50')}
            {readBlock('חולשות שלהם', c.weaknesses, 'border-emerald-200 bg-emerald-50')}
          </div>
        )}
        {(c.description.trim() || c.reps.trim()) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {readBlock('מי הם', c.description)}
            {readBlock('אנשי המכירות שלהם', c.reps)}
          </div>
        )}
        {!hasCard && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            עדיין לא הוזן מידע על המתחרה הזה.
            {isAdmin ? ' לחץ "עריכת הכרטיס" כדי להוסיף: מי הם, חוזקות, חולשות ומה אנחנו עונים.' : ' מנהל יוסיף כאן חוזקות, חולשות ותשובה לשיחה מולם.'}
          </p>
        )}
        {(site || topic) && (
          <div className="flex flex-wrap gap-2">
            {site && (
              <a href={site} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <ExternalLink size={14} /> אתר החברה
              </a>
            )}
            {topic && (
              <Link to={`/learn/${topic.id}`} className="btn-secondary">
                <BookOpen size={15} /> ללמוד: {topic.title}
              </Link>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-base font-semibold text-brand-800">איפה הם פעילים</h2>
          {hospitals.length === 0 ? (
            <p className="text-sm text-slate-500">אין רישומים עם בית חולים.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {hospitals.map((h) => (
                <li key={h.name} className="flex items-start justify-between gap-3 py-1.5">
                  <span dir="auto" className="min-w-0 text-slate-800">
                    {h.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {h.n} רישומים · {formatDate(h.last)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-base font-semibold text-brand-800">רופאים שעובדים איתם</h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-slate-500">אין רישומים עם רופא.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {doctors.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-1.5">
                  <Link to={`/doctors/${d.id}`} className="min-w-0 text-slate-800 hover:text-brand-600 hover:underline">
                    {d.name}
                  </Link>
                  {d.loyalty && <span className={classNames('chip shrink-0 !px-2 !py-0', LOYALTY_TONE[d.loyalty])}>{LOYALTY_LABELS[d.loyalty]}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-brand-800">כל הרישומים ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500">עדיין אין רישומים על המתחרה הזה.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((i) => (
              <li key={i.id} className="card p-3 text-sm">
                <p dir="auto" className="font-medium text-slate-800">
                  {formatDate(i.intel_date)}
                  {i.product && <span className="font-normal text-slate-500"> · {i.product}</span>}
                  {i.hospital && <span className="font-normal text-slate-500"> · {i.hospital.name}</span>}
                  {i.doctor && <span className="font-normal text-slate-500"> · {i.doctor.name}</span>}
                </p>
                <IntelChips i={i} />
                {i.offer && (
                  <p dir="auto" className="mt-1 whitespace-pre-line text-slate-700">
                    {i.offer}
                  </p>
                )}
                {i.notes && (
                  <p dir="auto" className="whitespace-pre-line text-xs text-slate-500">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <Modal open onClose={() => setEditing(false)} title={`עריכת הכרטיס: ${c.name}`} size="lg">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="שם">
                <input className="input" dir="auto" autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="מוצרים (מופרדים בפסיק)">
                <input className="input" dir="auto" value={form.products} onChange={(e) => set({ products: e.target.value })} placeholder="ROSA, VELYS" />
              </Field>
            </div>
            {area('מה אנחנו עונים', 'our_answer', 'התשובה שלנו בשיחה מול הרופא או ההנהלה')}
            {area('חוזקות', 'strengths')}
            {area('חולשות', 'weaknesses')}
            {area('מי הם', 'description', 'חברה, גודל, מי הנציג המקומי…')}
            {area('אנשי המכירות שלהם', 'reps')}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="אתר">
                <input className="input" type="url" inputMode="url" dir="ltr" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
              </Field>
              <Field label="נושא בלומדה">
                <select className="input" value={form.learn_topic_id ?? ''} onChange={(e) => set({ learn_topic_id: e.target.value || null })}>
                  <option value="">—</option>
                  {(topics.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex min-h-8 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-5 w-5" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> פעיל ברשימת הבחירה
            </label>
            {msg && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {msg}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <ConfirmButton className="btn-danger me-auto" message="למחוק את המתחרה? הרישומים עליו יישארו, בלי קישור לכרטיס." onConfirm={() => del.mutate(c.id, { onSuccess: () => navigate('/competitors?tab=list') })}>
                מחיקה
              </ConfirmButton>
              <button className="btn-secondary" onClick={() => setEditing(false)}>
                ביטול
              </button>
              <button className="btn-primary" onClick={submit} disabled={save.isPending || !form.name.trim()}>
                {save.isPending ? 'שומר…' : 'שמירה'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {adding && <IntelFormModal onClose={() => setAdding(false)} defaults={{ competitor_id: c.id, competitor: c.name, product: c.products.split(',')[0]?.trim() ?? '' }} />}
    </div>
  )
}
