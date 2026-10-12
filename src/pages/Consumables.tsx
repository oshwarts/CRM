import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Copy, Eye, Mail, Save, Trash2 } from 'lucide-react'
import {
  useAppSetting,
  useConsumableCounts,
  useConsumableItems,
  useConsumableMinimums,
  useDeleteConsumableCount,
  useMakoHospitals,
  useSaveConsumableCount,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'
import {
  CONSUMABLES_EMAIL_KEY,
  CONSUMABLES_INTRO_KEY,
  groupByCategory,
  shortageOf,
  shortageText,
  summarize,
  type CountRow,
} from '../lib/consumables'
import { buildMailto, buildOutlookWebUrl } from '../lib/mail'
import { copyText } from '../lib/scanExport'
import { classNames, formatDate, todayISO } from '../lib/utils'

const toInt = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function Consumables() {
  const { profile } = useAuth()
  const hospitals = useMakoHospitals()
  const items = useConsumableItems()
  const email = useAppSetting(CONSUMABLES_EMAIL_KEY)
  const intro = useAppSetting(CONSUMABLES_INTRO_KEY)
  const save = useSaveConsumableCount()
  const delCount = useDeleteConsumableCount()

  const [params, setParams] = useSearchParams()
  const [hospitalId, setHospitalId] = useState(params.get('hospital') ?? '')
  const [viewId, setViewId] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [minv, setMinv] = useState<Record<string, string>>({})
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [notice, setNotice] = useState('')
  const initKey = useRef<string | null>(null)

  const mins = useConsumableMinimums(hospitalId)
  const counts = useConsumableCounts(hospitalId)

  // default to the first MAKO hospital
  useEffect(() => {
    if (!hospitalId && hospitals.data?.length) setHospitalId(hospitals.data[0].id)
  }, [hospitalId, hospitals.data])

  const overrides = useMemo(
    () => new Map((mins.data ?? []).map((m) => [m.item_id, m.min_qty])),
    [mins.data],
  )

  // start a new count from the last one: same quantities, this hospital's minimums
  useEffect(() => {
    if (!hospitalId || !items.data || !mins.data || !counts.data) return
    if (initKey.current === hospitalId) return
    initKey.current = hospitalId
    const latest = counts.data[0]
    const lastQty = new Map((latest?.lines ?? []).map((l) => [l.item_id, l.qty]))
    setQty(Object.fromEntries(items.data.map((i) => [i.id, lastQty.has(i.id) ? String(lastQty.get(i.id)) : ''])))
    setMinv(Object.fromEntries(items.data.map((i) => [i.id, String(overrides.get(i.id) ?? i.default_min)])))
    setDate(todayISO())
    setNotes('')
  }, [hospitalId, items.data, mins.data, counts.data, overrides])

  function chooseHospital(id: string) {
    initKey.current = null
    setViewId(null)
    setNotice('')
    setHospitalId(id)
    setParams(id ? { hospital: id } : {}, { replace: true })
  }

  const hospitalName = hospitals.data?.find((h) => h.id === hospitalId)?.name ?? ''
  const viewed = viewId ? counts.data?.find((c) => c.id === viewId) : undefined

  const rows: CountRow[] = useMemo(() => {
    const list = items.data ?? []
    if (viewed) {
      const byItem = new Map(viewed.lines.map((l) => [l.item_id, l]))
      return list.flatMap((item) => {
        const l = byItem.get(item.id)
        return l ? [{ item, qty: l.qty, min: l.min_qty }] : []
      })
    }
    return list.map((item) => ({
      item,
      qty: toInt(qty[item.id]),
      min: toInt(minv[item.id]) ?? overrides.get(item.id) ?? item.default_min,
    }))
  }, [items.data, viewed, qty, minv, overrides])

  const { missing, units } = summarize(rows)
  const groups = groupByCategory(rows)
  const to = email.data ?? ''

  const mail = shortageText({
    intro: intro.data,
    hospital: hospitalName,
    countedOn: viewed?.counted_on ?? date,
    agent: viewed ? (viewed.counter?.full_name || viewed.counter?.email || '') : (profile?.full_name ?? ''),
    rows,
  })
  const mailto = buildMailto(to, mail.subject, mail.body)
  const outlookUrl = buildOutlookWebUrl(to, mail.subject, mail.body)
  const canMail = !!to && missing.length > 0

  async function onMailtoClick() {
    if (mailto.mode === 'copied') {
      await copyText(mail.body)
      setNotice('הרשימה ארוכה מדי לגוף הטיוטה — הועתקה ללוח. הדבק אותה במייל (Ctrl+V).')
    } else {
      setNotice('אם לא נפתחה טיוטה, אין אפליקציית מייל מוגדרת במכשיר — נסה "פתח ב-Outlook". שום דבר לא נשלח לפני שתלחץ "שלח".')
    }
  }

  async function copyList() {
    const { body } = shortageText({
      intro: intro.data,
      hospital: hospitalName,
      countedOn: viewed?.counted_on ?? date,
      agent: viewed ? (viewed.counter?.full_name ?? '') : (profile?.full_name ?? ''),
      rows,
    })
    setNotice((await copyText(body)) ? 'רשימת החוסרים הועתקה.' : 'ההעתקה נכשלה.')
  }

  async function saveCount() {
    const list = items.data ?? []
    const blanks = list.filter((i) => toInt(qty[i.id]) === null).length
    if (blanks > 0 && !window.confirm(`${blanks} פריטים ללא כמות יישמרו כ-0. להמשיך?`)) return
    const lines = list.map((i) => ({
      item_id: i.id,
      qty: toInt(qty[i.id]) ?? 0,
      min_qty: toInt(minv[i.id]) ?? overrides.get(i.id) ?? i.default_min,
    }))
    try {
      await save.mutateAsync({
        hospitalId,
        countedOn: date,
        notes: notes.trim(),
        lines,
        overrides: lines
          .filter((l, k) => l.min_qty !== list[k].default_min)
          .map((l) => ({ item_id: l.item_id, min_qty: l.min_qty })),
        clearOverrides: lines
          .filter((l, k) => l.min_qty === list[k].default_min && overrides.has(l.item_id))
          .map((l) => l.item_id),
      })
      setNotice('הספירה נשמרה.')
    } catch (e) {
      setNotice(e instanceof Error ? `שמירה נכשלה: ${e.message}` : 'שמירה נכשלה')
    }
  }

  if (hospitals.isLoading || items.isLoading) return <Spinner />
  if (hospitals.error) return <ErrorState error={hospitals.error} />

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">מתכלים MAKO</h1>
        <p className="text-sm text-slate-400">
          ספירת מלאי בבית חולים · המערכת מחשבת אוטומטית כמה חסר מול המינימום
        </p>
      </div>

      {(hospitals.data ?? []).length === 0 ? (
        <EmptyState
          title="אין בתי חולים עם רובוט MAKO"
          hint="סמן רובוטיקה MAKO בבית חולים בהגדרות כדי לבצע ספירה"
        />
      ) : (
        <>
          <div className="card grid gap-3 p-4 sm:grid-cols-3">
            <label className="block">
              <span className="label">בית חולים</span>
              <select className="input" value={hospitalId} onChange={(e) => chooseHospital(e.target.value)}>
                {(hospitals.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">תאריך ספירה</span>
              <input
                type="date"
                className="input"
                value={viewed ? viewed.counted_on : date}
                disabled={!!viewed}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <div className="block">
              <span className="label">נספר ע״י</span>
              <p className="input bg-slate-50 text-slate-600">
                {viewed ? (viewed.counter?.full_name || viewed.counter?.email || '—') : (profile?.full_name || profile?.email || '—')}
              </p>
            </div>
          </div>

          {viewed && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>צופה בספירה מתאריך {formatDate(viewed.counted_on)} (לקריאה בלבד)</span>
              <button className="btn-secondary" onClick={() => setViewId(null)}>
                חזרה לספירה חדשה
              </button>
            </div>
          )}

          {(counts.isLoading || mins.isLoading) && <Spinner />}
          {counts.error && <ErrorState error={counts.error} />}

          {groups.map((g) => (
            <section key={g.category} className="card overflow-hidden">
              <h2 className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">{g.category}</h2>
              <ul className="divide-y divide-slate-100">
                {g.rows.map((r) => {
                  const short = shortageOf(r)
                  const surplus = r.qty !== null && r.qty > r.min ? r.qty - r.min : 0
                  return (
                    <li key={r.item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p dir="ltr" className="text-left text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">
                          {r.item.name}
                        </p>
                        {r.item.catalog_number && (
                          <p dir="ltr" className="text-left text-xs text-slate-400">{r.item.catalog_number}</p>
                        )}
                      </div>
                      <div className="grid shrink-0 grid-cols-3 gap-2 text-center sm:w-72">
                        <label className="block">
                          <span className="block text-[11px] text-slate-400">מינימום</span>
                          {viewed ? (
                            <p className="py-2 text-sm text-slate-600">{r.min}</p>
                          ) : (
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              className="input !px-1 text-center"
                              value={minv[r.item.id] ?? ''}
                              onChange={(e) => setMinv((m) => ({ ...m, [r.item.id]: e.target.value }))}
                            />
                          )}
                        </label>
                        <label className="block">
                          <span className="block text-[11px] text-slate-400">בפועל</span>
                          {viewed ? (
                            <p className="py-2 text-sm font-medium text-slate-800">{r.qty}</p>
                          ) : (
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              className="input !px-1 text-center font-semibold"
                              value={qty[r.item.id] ?? ''}
                              onChange={(e) => setQty((m) => ({ ...m, [r.item.id]: e.target.value }))}
                            />
                          )}
                        </label>
                        <div>
                          <span className="block text-[11px] text-slate-400">חסר</span>
                          <p
                            className={classNames(
                              'rounded-lg py-2 text-sm font-bold',
                              r.qty === null && 'text-slate-300',
                              short > 0 && 'bg-red-50 text-red-600',
                              r.qty !== null && short === 0 && surplus === 0 && 'text-emerald-600',
                              surplus > 0 && 'text-slate-400',
                            )}
                          >
                            {r.qty === null ? '—' : short > 0 ? short : surplus > 0 ? `+${surplus}` : '✓'}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {!viewed && (
            <label className="block">
              <span className="label">הערות לספירה</span>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          )}

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 card space-y-2 p-3 shadow-lg md:bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={classNames('text-sm font-semibold', missing.length ? 'text-red-600' : 'text-emerald-600')}>
                {missing.length
                  ? `חסרים ${missing.length} פריטים · ${units} יחידות`
                  : 'אין חוסרים'}
              </p>
              <div className="flex flex-wrap gap-2">
                {!viewed && (
                  <button className="btn-primary" onClick={saveCount} disabled={save.isPending}>
                    <Save size={16} />
                    שמור ספירה
                  </button>
                )}
                {canMail ? (
                  <>
                    <a
                      className="btn-secondary"
                      href={outlookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        setNotice('נפתחה טיוטה ב-Outlook בדפדפן — בדוק אותה ולחץ "שלח". שום דבר לא נשלח לפני כן.')
                      }
                    >
                      <Mail size={16} />
                      פתח ב-Outlook
                    </a>
                    <a className="btn-secondary" href={mailto.url} onClick={onMailtoClick}>
                      <Mail size={16} />
                      אפליקציית מייל
                    </a>
                  </>
                ) : (
                  <button className="btn-secondary" disabled title={to ? 'אין חוסרים' : 'לא הוגדרה כתובת מייל'}>
                    <Mail size={16} />
                    פתח מייל חוסרים
                  </button>
                )}
                <button className="btn-secondary" onClick={copyList} disabled={missing.length === 0}>
                  <Copy size={16} />
                  העתק
                </button>
              </div>
            </div>
            {!to && (
              <p className="text-xs text-amber-600">
                לא הוגדרה כתובת מייל לשליחת חוסרים — הגדרה בעמוד{' '}
                <Link to="/settings" className="font-medium underline">הגדרות ← מתכלים</Link>.
              </p>
            )}
            {to && missing.length > 0 && !notice && (
              <p className="text-xs text-slate-400">
                הכפתורים פותחים טיוטה בלבד — המייל נשלח רק אחרי שתבדוק ותלחץ "שלח". אם אין אפליקציית מייל במכשיר, השתמש ב"פתח ב-Outlook".
              </p>
            )}
            {notice && <p className="text-xs text-slate-500">{notice}</p>}
          </div>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold text-slate-800">היסטוריית ספירות</h2>
            {(counts.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">עוד לא בוצעו ספירות בבית חולים זה.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {(counts.data ?? []).map((c) => {
                  const short = c.lines.filter((l) => l.qty < l.min_qty).length
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-slate-700">
                        {formatDate(c.counted_on)}
                        <span className="mr-2 text-xs text-slate-400">
                          {c.counter?.full_name || c.counter?.email || ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={classNames('chip', short ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
                          {short ? `${short} חסרים` : 'תקין'}
                        </span>
                        <button className="btn-ghost !px-2" onClick={() => setViewId(c.id)} aria-label="הצג">
                          <Eye size={16} />
                        </button>
                        <ConfirmButton className="btn-ghost !px-2 text-red-500" onConfirm={() => delCount.mutate(c.id)}>
                          <Trash2 size={16} />
                        </ConfirmButton>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
