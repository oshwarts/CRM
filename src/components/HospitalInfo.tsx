import { useEffect, useMemo, useState } from 'react'
import { ScanCoordination } from './ScanCoordination'
import { SurgeryDays } from './SurgeryDays'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useProcedures } from '../lib/api'
import { toast } from '../lib/toast'
import { classNames } from '../lib/utils'
import {
  LOCATION_PRESETS,
  perYear,
  totalPerYear,
  useCaseEstimates,
  useDeleteEstimate,
  useDeleteLocation,
  useGeneralInfo,
  useLocations,
  useSaveEstimate,
  useSaveGeneralInfo,
  useSaveLocation,
  type CaseEstimate,
  type HospitalLocation,
} from '../lib/hospitalInfo'
import { ConfirmButton, EmptyState, ErrorState, Field, Modal, Spinner } from './ui'

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'השמירה נכשלה', { kind: 'error' })

/** the estimated cases per procedure in this hospital */
function Estimates({ hospitalId }: { hospitalId: string }) {
  const list = useCaseEstimates(hospitalId)
  const procedures = useProcedures()
  const save = useSaveEstimate(hospitalId)
  const del = useDeleteEstimate(hospitalId)
  const [editing, setEditing] = useState<Partial<CaseEstimate> | null>(null)
  const nameOf = (e: CaseEstimate) => (e.procedure_id ? (procedures.data ?? []).find((p) => p.id === e.procedure_id)?.name : '') || e.procedure_text || 'הליך'
  const total = totalPerYear(list.data ?? [])

  return (
    <section aria-label="הערכת מקרים לפי הליך" className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-brand-800">כמות מקרים מוערכת לפי הליך</h2>
          <p className="text-xs text-slate-500">הערכה של כמה מקרים מתבצעים בבית החולים, לא ספירה מדויקת</p>
        </div>
        <button className="btn-secondary" onClick={() => setEditing({ cases: 0, period: 'year' })}>
          <Plus size={16} aria-hidden /> הוסף הליך
        </button>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="עדיין לא הוזנה הערכה" hint="הוסף הליך וכמה מקרים מוערכים בשנה" />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {(list.data ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1 basis-40">
                  <p dir="auto" className="break-words text-sm font-medium text-slate-800">{nameOf(e)}</p>
                  {e.note && <p dir="auto" className="text-xs text-slate-500 [overflow-wrap:anywhere]">{e.note}</p>}
                </div>
                <p className="shrink-0 text-sm text-slate-700">
                  <span className="text-lg font-semibold text-brand-800">{e.cases}</span> {e.period === 'month' ? 'בחודש' : 'בשנה'}
                  {e.period === 'month' && <span className="text-xs text-slate-500"> (≈ {perYear(e)} בשנה)</span>}
                </p>
                <div className="flex shrink-0">
                  <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`עריכת ${nameOf(e)}`} onClick={() => setEditing(e)}>
                    <Pencil size={16} aria-hidden />
                  </button>
                  <ConfirmButton className="btn-ghost !min-h-10 !px-2 !text-red-600" message={`למחוק את ההערכה של ${nameOf(e)}?`} label={`מחיקת ${nameOf(e)}`} onConfirm={() => del.mutate(e.id, { onError: fail })}>
                    <Trash2 size={16} aria-hidden />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">
            סה״כ מוערך: <span className="font-semibold text-slate-800">{total}</span> מקרים בשנה
          </p>
        </>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'עריכת הערכה' : 'הערכה חדשה'} size="md">
          <EstimateForm
            initial={editing}
            procedures={(procedures.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
            saving={save.isPending}
            onCancel={() => setEditing(null)}
            onSave={(e) => save.mutate(e, { onSuccess: () => setEditing(null), onError: fail })}
          />
        </Modal>
      )}
    </section>
  )
}

function EstimateForm({ initial, procedures, saving, onCancel, onSave }: { initial: Partial<CaseEstimate>; procedures: { id: string; name: string }[]; saving: boolean; onCancel: () => void; onSave: (e: Partial<CaseEstimate> & { cases: number }) => void }) {
  const [procId, setProcId] = useState(initial.procedure_id ?? (initial.procedure_text ? '__text' : ''))
  const [text, setText] = useState(initial.procedure_text ?? '')
  const [cases, setCases] = useState(String(initial.cases ?? 0))
  const [period, setPeriod] = useState<'year' | 'month'>(initial.period ?? 'year')
  const [note, setNote] = useState(initial.note ?? '')
  const [error, setError] = useState('')
  function submit() {
    if (!procId) return setError('בחר הליך')
    if (procId === '__text' && !text.trim()) return setError('כתוב את שם ההליך')
    const n = Number(cases)
    if (!Number.isFinite(n) || n < 0) return setError('הכמות צריכה להיות מספר')
    onSave({ ...initial, procedure_id: procId === '__text' ? null : procId, procedure_text: procId === '__text' ? text : '', cases: n, period, note })
  }
  return (
    <div className="space-y-3">
      <Field label="הליך">
        <select className="input" value={procId} onChange={(e) => setProcId(e.target.value)} autoFocus>
          <option value="">בחר…</option>
          {procedures.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="__text">אחר (לכתוב ידנית)</option>
        </select>
      </Field>
      {procId === '__text' && (
        <Field label="שם ההליך">
          <input className="input" dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="כמות מקרים">
          <input className="input" type="number" min={0} inputMode="numeric" value={cases} onChange={(e) => setCases(e.target.value)} />
        </Field>
        <Field label="לפי">
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as 'year' | 'month')}>
            <option value="year">שנה</option>
            <option value="month">חודש</option>
          </select>
        </Field>
      </div>
      <Field label="הערה (לא חובה)">
        <input className="input" dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: מקור ההערכה" />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-primary max-sm:flex-1" disabled={saving} onClick={submit}>שמירה</button>
      </div>
    </div>
  )
}

/** free general information about the hospital */
function GeneralInfo({ hospitalId }: { hospitalId: string }) {
  const info = useGeneralInfo(hospitalId)
  const save = useSaveGeneralInfo(hospitalId)
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (info.data !== undefined && !touched) setText(info.data)
  }, [info.data, touched])
  const dirty = touched && text.trim() !== (info.data ?? '').trim()
  return (
    <section aria-label="מידע כללי" className="card p-4 sm:p-5">
      <h2 className="mb-2 text-base font-semibold text-brand-800">מידע כללי</h2>
      {info.isLoading ? (
        <Spinner />
      ) : (
        <>
          <textarea
            className="input min-h-32"
            dir="auto"
            aria-label="מידע כללי על בית החולים"
            placeholder="כל מה שחשוב לדעת על בית החולים: נהלים, שעות, חניה, הנחיות, הערות…"
            value={text}
            onChange={(e) => (setText(e.target.value), setTouched(true))}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {dirty && <span className="text-xs text-amber-700">יש שינויים שלא נשמרו</span>}
            <button
              type="button"
              className="btn-primary"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(text, { onSuccess: () => (setTouched(false), toast('המידע נשמר')), onError: fail })}
            >
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/** where people and departments are in the hospital: the head of the department, rooms, floors */
export function Locations({ hospitalId, compact }: { hospitalId: string; compact?: boolean }) {
  const list = useLocations(hospitalId)
  const save = useSaveLocation(hospitalId)
  const del = useDeleteLocation(hospitalId)
  const [editing, setEditing] = useState<Partial<HospitalLocation> | null>(null)
  const items = useMemo(() => list.data ?? [], [list.data])
  const shown = compact ? items.slice(0, 6) : items

  const row = (l: HospitalLocation) => (
    <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
      <div className="min-w-0 flex-1 basis-48">
        <p dir="auto" className="break-words text-sm font-medium text-slate-800">
          {l.title}
          {l.person && <span className="font-normal text-slate-600"> · {l.person}</span>}
        </p>
        <p dir="auto" className={classNames('break-words text-sm', l.place ? 'text-brand-700' : 'text-slate-400')}>{l.place || 'לא צוין מיקום'}</p>
        {l.note && <p dir="auto" className="text-xs text-slate-500 [overflow-wrap:anywhere]">{l.note}</p>}
      </div>
      {!compact && (
        <div className="flex shrink-0">
          <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`עריכת ${l.title}`} onClick={() => setEditing(l)}>
            <Pencil size={16} aria-hidden />
          </button>
          <ConfirmButton className="btn-ghost !min-h-10 !px-2 !text-red-600" message={`למחוק את "${l.title}"?`} label={`מחיקת ${l.title}`} onConfirm={() => del.mutate(l.id, { onError: fail })}>
            <Trash2 size={16} aria-hidden />
          </ConfirmButton>
        </div>
      )}
    </li>
  )

  if (compact) return items.length === 0 ? <p className="text-sm text-slate-400">עדיין לא הוזנו מיקומים</p> : <ul className="divide-y divide-slate-100">{shown.map(row)}</ul>

  return (
    <section aria-label="מיקומים בבית החולים" className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-brand-800">איפה נמצאים: מחלקות, חדרים ואנשים</h2>
          <p className="text-xs text-slate-500">למשל איפה יושב מנהל המחלקה, באיזה חדר, בקומה ובבניין. אפשר להוסיף כל מיקום שחשוב לדעת</p>
        </div>
        <button className="btn-secondary" onClick={() => setEditing({ title: '', person: '', place: '', note: '' })}>
          <Plus size={16} aria-hidden /> הוסף מיקום
        </button>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : items.length === 0 ? (
        <div>
          <EmptyState title="עדיין לא הוזנו מיקומים" hint="התחל ממנהל המחלקה, או בחר מהרשימה" />
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {LOCATION_PRESETS.map((p) => (
              <button key={p} type="button" className="min-h-[40px] rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setEditing({ title: p, person: '', place: '', note: '' })}>
                + {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">{items.map(row)}</ul>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'עריכת מיקום' : 'מיקום חדש'} size="md">
          <LocationForm initial={editing} saving={save.isPending} onCancel={() => setEditing(null)} onSave={(l) => save.mutate({ ...l, sort: editing.sort ?? items.length }, { onSuccess: () => setEditing(null), onError: fail })} />
        </Modal>
      )}
    </section>
  )
}

function LocationForm({ initial, saving, onCancel, onSave }: { initial: Partial<HospitalLocation>; saving: boolean; onCancel: () => void; onSave: (l: { id?: string; title: string; person: string; place: string; note: string }) => void }) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [person, setPerson] = useState(initial.person ?? '')
  const [place, setPlace] = useState(initial.place ?? '')
  const [note, setNote] = useState(initial.note ?? '')
  const [error, setError] = useState('')
  return (
    <div className="space-y-3">
      <Field label="מי או מה">
        <input className="input" dir="auto" autoFocus list="location-presets" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: מנהל מחלקה אורתופדית" />
        <datalist id="location-presets">
          {LOCATION_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label="שם האדם (לא חובה)">
        <input className="input" dir="auto" value={person} onChange={(e) => setPerson(e.target.value)} />
      </Field>
      <Field label="איפה (בניין, קומה, חדר)">
        <input className="input" dir="auto" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="למשל: בניין ב׳, קומה 3, חדר 312" />
      </Field>
      <Field label="הערה (לא חובה)">
        <input className="input" dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: שעות קבלה, איך מגיעים" />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button
          type="button"
          className="btn-primary max-sm:flex-1"
          disabled={saving}
          onClick={() => (title.trim() ? onSave({ id: initial.id, title, person, place, note }) : setError('כתוב מי או מה'))}
        >
          שמירה
        </button>
      </div>
    </div>
  )
}

/** the tab of a hospital: estimated cases, general information and the places */
export function HospitalInfo({ hospitalId, surgeryDays }: { hospitalId: string; surgeryDays?: number[] | null }) {
  return (
    <div className="space-y-4">
      <SurgeryDays hospitalId={hospitalId} days={surgeryDays} />
      <div className="grid">
        <ScanCoordination hospitalId={hospitalId} />
      </div>
      <Locations hospitalId={hospitalId} />
      <Estimates hospitalId={hospitalId} />
      <GeneralInfo hospitalId={hospitalId} />
    </div>
  )
}
