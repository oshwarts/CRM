import { useState } from 'react'
import { Camera, CheckSquare, ChevronDown, Pencil, Plus, Swords, X } from 'lucide-react'
import {
  shrinkImage,
  useCompetitorIntel,
  useCompetitors,
  useDeleteIntel,
  useDoctors,
  useEquipmentImageUrl,
  useHospitals,
  useSaveIntel,
  type IntelFormData,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import type { CompetitorIntelRow } from '../lib/types'
import { LOSS_REASONS, LOYALTY_LABELS, LOYALTY_TONE, OUTCOME_LABELS, OUTCOME_TONE, isStale, money } from '../lib/competitors'
import { classNames, formatDate, plusDaysISO, todayISO } from '../lib/utils'
import { ConfirmButton, Field, Modal } from './ui'
import { SearchSelect } from './SearchSelect'
import { TaskFormModal } from './TaskFormModal'

const num = (v: string): number | null => {
  const n = Number(v.replace(/[,₪\s]/g, ''))
  return v.trim() === '' || Number.isNaN(n) ? null : n
}

/** a stored picture (private bucket, short-lived link) */
export function IntelPicture({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const url = useEquipmentImageUrl(path)
  return (
    <span className="relative inline-block">
      {url.data ? (
        <a href={url.data} target="_blank" rel="noopener noreferrer">
          <img src={url.data} alt="" loading="lazy" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
        </a>
      ) : (
        <span className="block h-20 w-20 animate-pulse rounded-lg bg-slate-100" />
      )}
      {onRemove && (
        <button type="button" className="absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-white" onClick={onRemove} aria-label="הסר תמונה">
          <X size={12} />
        </button>
      )}
    </span>
  )
}

/** add / edit a competitor record. The top part is enough for a quick note from the field; the rest is folded. */
export function IntelFormModal({
  intel,
  defaults,
  onClose,
}: {
  intel?: CompetitorIntelRow | null
  defaults?: Partial<IntelFormData>
  onClose: () => void
}) {
  const { isAdmin } = useAuth()
  const competitors = useCompetitors()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const save = useSaveIntel()
  const del = useDeleteIntel()
  const [error, setError] = useState('')
  const [more, setMore] = useState(!!intel)
  const [manual, setManual] = useState(!!intel && !intel.competitor_id && !!intel.competitor)
  const [d, setD] = useState<IntelFormData>(() =>
    intel
      ? {
          id: intel.id,
          competitor_id: intel.competitor_id,
          competitor: intel.competitor,
          product: intel.product,
          offer: intel.offer,
          notes: intel.notes,
          intel_date: intel.intel_date,
          doctor_id: intel.doctor_id,
          hospital_id: intel.hospital_id,
          outcome: (intel.outcome as IntelFormData['outcome']) ?? 'open',
          loss_reason: intel.loss_reason,
          contract_end: intel.contract_end,
          tender_name: intel.tender_name,
          tender_due: intel.tender_due,
          loyalty: (intel.loyalty as IntelFormData['loyalty']) ?? '',
          price_per_case: intel.price_per_case,
          implant_price: intel.implant_price,
          payment_terms: intel.payment_terms,
          image_paths: intel.image_paths ?? [],
        }
      : {
          competitor_id: null,
          competitor: '',
          product: '',
          offer: '',
          notes: '',
          intel_date: todayISO(),
          doctor_id: null,
          hospital_id: null,
          outcome: 'open',
          loss_reason: '',
          contract_end: null,
          tender_name: '',
          tender_due: null,
          loyalty: '',
          price_per_case: null,
          implant_price: null,
          payment_terms: '',
          image_paths: [],
          ...defaults,
        },
  )
  const [newPics, setNewPics] = useState<{ blob: Blob; url: string }[]>([])
  const set = (p: Partial<IntelFormData>) => setD((x) => ({ ...x, ...p }))

  const list = (competitors.data ?? []).filter((c) => c.active || c.id === d.competitor_id)
  const chosen = list.find((c) => c.id === d.competitor_id)

  async function addPictures(files: FileList | null) {
    if (!files) return
    const added: { blob: Blob; url: string }[] = []
    for (const f of [...files].slice(0, 6)) {
      const blob = await shrinkImage(f)
      added.push({ blob, url: URL.createObjectURL(blob) })
    }
    setNewPics((x) => [...x, ...added].slice(0, 6))
  }

  async function submit() {
    setError('')
    if (!d.competitor.trim()) return setError('בחר או כתוב מי המתחרה')
    if (d.outcome === 'lost' && !d.loss_reason) {
      setMore(true)
      return setError('סמן את סיבת ההפסד')
    }
    try {
      await save.mutateAsync({ ...d, newImages: newPics.map((p) => p.blob) })
      newPics.forEach((p) => URL.revokeObjectURL(p.url))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={intel ? 'עריכת פעילות מתחרה' : 'פעילות מתחרה חדשה'} size="md">
      <div className="space-y-3">
        <Field label="מתחרה">
          {manual ? (
            <div className="flex gap-2">
              <input className="input" placeholder="שם המתחרה" value={d.competitor} onChange={(e) => set({ competitor: e.target.value, competitor_id: null })} autoFocus />
              <button type="button" className="btn-secondary shrink-0" onClick={() => { setManual(false); set({ competitor: '', competitor_id: null }) }}>
                מהרשימה
              </button>
            </div>
          ) : (
            <select
              className="input"
              value={d.competitor_id ?? ''}
              onChange={(e) => {
                if (e.target.value === '__other') {
                  setManual(true)
                  set({ competitor: '', competitor_id: null })
                } else {
                  const c = list.find((x) => x.id === e.target.value)
                  set({ competitor_id: c?.id ?? null, competitor: c?.name ?? '', product: d.product || c?.products.split(',')[0]?.trim() || '' })
                }
              }}
            >
              <option value="">בחר מתחרה…</option>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__other">אחר (לא ברשימה)</option>
            </select>
          )}
          {manual && <p className="mt-1 text-xs text-slate-400">{isAdmin ? 'אפשר להוסיף אותו לרשימה בעמוד "מתחרים".' : 'מנהל יוסיף אותו לרשימה.'}</p>}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="בית חולים">
            <SearchSelect options={(hospitals.data ?? []).map((h) => ({ id: h.id, label: h.name }))} value={d.hospital_id} onChange={(id) => set({ hospital_id: id })} placeholder="בחר בית חולים…" />
          </Field>
          <Field label="רופא (אופציונלי)">
            <SearchSelect options={(doctors.data ?? []).map((x) => ({ id: x.id, label: `${x.title} ${x.name}`.trim() }))} value={d.doctor_id} onChange={(id) => set({ doctor_id: id })} placeholder="בחר רופא…" />
          </Field>
        </div>

        <Field label="מה ראית / שמעת">
          <textarea className="input min-h-20" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="במשפט או שניים" />
        </Field>

        <button type="button" className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600" onClick={() => setMore((v) => !v)}>
          פרטים נוספים (מוצר, תוצאה, חוזה, מחירים, תמונות)
          <ChevronDown size={16} className={classNames('transition', more && 'rotate-180')} />
        </button>

        {more && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="מוצר / רובוט / שתל">
                <input className="input" value={d.product} onChange={(e) => set({ product: e.target.value })} placeholder={chosen?.products || 'למשל: ROSA, VELYS'} />
              </Field>
              <Field label="תאריך">
                <input type="date" className="input" value={d.intel_date} onChange={(e) => set({ intel_date: e.target.value })} />
              </Field>
            </div>
            <Field label="מה מציעים / תנאים">
              <textarea className="input min-h-16" dir="auto" value={d.offer} onChange={(e) => set({ offer: e.target.value })} placeholder="הנחות, תנאי מימון, הדרכה, השאלת ציוד…" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="תוצאה מולנו">
                <select className="input" value={d.outcome} onChange={(e) => set({ outcome: e.target.value as IntelFormData['outcome'] })}>
                  {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              {d.outcome === 'lost' && (
                <Field label="סיבת ההפסד">
                  <select className="input" value={d.loss_reason} onChange={(e) => set({ loss_reason: e.target.value })}>
                    <option value="">בחר…</option>
                    {LOSS_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {d.doctor_id && (
                <Field label="יחס הרופא למתחרה">
                  <select className="input" value={d.loyalty} onChange={(e) => set({ loyalty: e.target.value as IntelFormData['loyalty'] })}>
                    <option value="">לא ידוע</option>
                    {Object.entries(LOYALTY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="סיום חוזה / התקשרות עם המתחרה">
                <input type="date" className="input" value={d.contract_end ?? ''} onChange={(e) => set({ contract_end: e.target.value || null })} />
              </Field>
              <Field label="מכרז (שם)">
                <input className="input" dir="auto" value={d.tender_name} onChange={(e) => set({ tender_name: e.target.value })} />
              </Field>
              {d.tender_name.trim() !== '' && (
                <Field label="מועד הגשה / סגירת המכרז">
                  <input type="date" className="input" value={d.tender_due ?? ''} onChange={(e) => set({ tender_due: e.target.value || null })} />
                </Field>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="מחיר למקרה (₪)">
                <input className="input" inputMode="decimal" dir="ltr" value={d.price_per_case ?? ''} onChange={(e) => set({ price_per_case: num(e.target.value) })} />
              </Field>
              <Field label="מחיר שתל (₪)">
                <input className="input" inputMode="decimal" dir="ltr" value={d.implant_price ?? ''} onChange={(e) => set({ implant_price: num(e.target.value) })} />
              </Field>
              <Field label="תנאי תשלום">
                <input className="input" dir="auto" value={d.payment_terms} onChange={(e) => set({ payment_terms: e.target.value })} />
              </Field>
            </div>

            <div>
              <span className="label">תמונות (מחירון, ברושור, הצעה)</span>
              <div className="flex flex-wrap gap-2">
                {d.image_paths.map((p) => (
                  <IntelPicture key={p} path={p} onRemove={() => set({ image_paths: d.image_paths.filter((x) => x !== p) })} />
                ))}
                {newPics.map((p) => (
                  <span key={p.url} className="relative inline-block">
                    <img src={p.url} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                    <button type="button" className="absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-white" onClick={() => setNewPics((x) => x.filter((y) => y !== p))} aria-label="הסר תמונה">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {d.image_paths.length + newPics.length < 6 && (
                  <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:bg-slate-50">
                    <Camera size={22} />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addPictures(e.target.files)} />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div>
            {intel && (
              <ConfirmButton message="למחוק את הרישום?" onConfirm={() => del.mutate(intel.id, { onSuccess: onClose })}>
                מחיקה
              </ConfirmButton>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** the one-line facts of a record (outcome, loyalty, contract …) as chips */
export function IntelChips({ i }: { i: CompetitorIntelRow }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {i.outcome !== 'open' && (
        <span className={classNames('chip !px-2 !py-0', OUTCOME_TONE[i.outcome])}>
          {OUTCOME_LABELS[i.outcome]}
          {i.outcome === 'lost' && i.loss_reason ? `: ${i.loss_reason}` : ''}
        </span>
      )}
      {i.loyalty && <span className={classNames('chip !px-2 !py-0', LOYALTY_TONE[i.loyalty])}>{LOYALTY_LABELS[i.loyalty]}</span>}
      {i.contract_end && <span className="chip border-violet-200 bg-violet-50 !px-2 !py-0 text-violet-700">חוזה עד {formatDate(i.contract_end)}</span>}
      {i.tender_name && (
        <span className="chip border-violet-200 bg-violet-50 !px-2 !py-0 text-violet-700">
          מכרז: {i.tender_name}
          {i.tender_due ? ` · עד ${formatDate(i.tender_due)}` : ''}
        </span>
      )}
      {(i.price_per_case !== null || i.implant_price !== null) && (
        <span className="chip border-slate-200 bg-white !px-2 !py-0 text-slate-600">
          {i.price_per_case !== null ? `למקרה ${money(i.price_per_case)}` : ''}
          {i.price_per_case !== null && i.implant_price !== null ? ' · ' : ''}
          {i.implant_price !== null ? `שתל ${money(i.implant_price)}` : ''}
        </span>
      )}
      {i.payment_terms && <span className="chip border-slate-200 bg-white !px-2 !py-0 text-slate-600">{i.payment_terms}</span>}
      {isStale(i) && <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-amber-700">לא עודכן מעל 90 יום</span>}
    </span>
  )
}

/** a task prepared from a record ("a counter move"), ready to adjust and save */
export function taskFromIntel(i: CompetitorIntelRow) {
  return {
    description: `מענה למתחרה ${i.competitor}${i.product ? ` (${i.product})` : ''}${i.hospital ? ` — ${i.hospital.name}` : ''}`,
    notes: [i.offer, i.notes].filter(Boolean).join('\n'),
    doctor_id: i.doctor_id,
    hospital_id: i.hospital_id,
    due_date: i.contract_end && i.contract_end > plusDaysISO(14) ? plusDaysISO(14) : plusDaysISO(7),
  }
}

/** competitor activity linked to one doctor or one hospital */
export function CompetitorSection({ doctorId, hospitalId }: { doctorId?: string; hospitalId?: string }) {
  const intel = useCompetitorIntel()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CompetitorIntelRow | null>(null)
  const [taskFor, setTaskFor] = useState<CompetitorIntelRow | null>(null)
  const list = (intel.data ?? []).filter((i) => (doctorId ? i.doctor_id === doctorId : hospitalId ? i.hospital_id === hospitalId : false))
  // the doctor's current situation: the newest record that tells which competitor he works with and how loyal he is
  const current = doctorId ? list.find((i) => i.loyalty) ?? list[0] : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <Swords size={12} /> פעילות מתחרים ({list.length})
        </p>
        <button className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setAdding(true)}>
          <Plus size={14} className="inline" /> הוסף
        </button>
      </div>
      {current && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
          עובד כיום עם <b>{current.competitor}</b>
          {current.product && ` (${current.product})`}
          {current.loyalty && <span className={classNames('chip !px-2 !py-0', LOYALTY_TONE[current.loyalty])}>{LOYALTY_LABELS[current.loyalty]}</span>}
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-slate-400">לא תועדה פעילות של מתחרים</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {list.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-800">
                  {i.competitor}
                  {i.product && <span className="font-normal text-slate-500"> · {i.product}</span>}
                  <span className="mr-2 text-xs font-normal text-slate-400">{formatDate(i.intel_date)}</span>
                </p>
                <IntelChips i={i} />
                {i.offer && <p dir="auto" className="whitespace-pre-line text-slate-600">{i.offer}</p>}
                {i.notes && <p dir="auto" className="whitespace-pre-line text-xs text-slate-400">{i.notes}</p>}
                {i.image_paths?.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {i.image_paths.map((p) => (
                      <IntelPicture key={p} path={p} />
                    ))}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button className="btn-ghost !px-2" onClick={() => setTaskFor(i)} aria-label="צור משימה" title="צור משימה מהרישום">
                  <CheckSquare size={14} />
                </button>
                <button className="btn-ghost !px-2" onClick={() => setEditing(i)} aria-label="עריכה">
                  <Pencil size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding && <IntelFormModal onClose={() => setAdding(false)} defaults={{ doctor_id: doctorId ?? null, hospital_id: hospitalId ?? null }} />}
      {editing && <IntelFormModal intel={editing} onClose={() => setEditing(null)} />}
      {taskFor && <TaskFormModal onClose={() => setTaskFor(null)} defaults={taskFromIntel(taskFor)} />}
    </div>
  )
}
