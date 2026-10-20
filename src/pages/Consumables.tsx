import { SettingsLink } from '../components/SettingsLink'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PendingMark } from '../components/PendingMark'
import { useSearchParams } from 'react-router-dom'
import { Copy, Eye, Mail, Minus, Plus, Save, Trash2 } from 'lucide-react'
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
import { StockForecast } from '../components/StockForecast'
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

const STEP_BTN =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-700 transition hover:bg-brand-50 active:bg-brand-100'

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
  const [onlyShort, setOnlyShort] = useState(false)
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
  const onlyShortActive = onlyShort && missing.length > 0
  const groups = groupByCategory(onlyShortActive ? rows.filter((r) => shortageOf(r) > 0) : rows)
  const counted = rows.filter((r) => r.qty !== null).length
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

  function step(id: string, delta: number) {
    setQty((m) => ({ ...m, [id]: String(Math.max(0, (toInt(m[id]) ?? 0) + delta)) }))
  }

  if (hospitals.isLoading || items.isLoading) return <Spinner />
  if (hospitals.error && !hospitals.data) return <ErrorState error={hospitals.error} /> // cached data stays visible when only a background refresh failed

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">מתכלים MAKO</h1>
        <p className="text-sm text-slate-500">
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
          <div className="card space-y-3 p-3 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0 sm:p-4">
            <label className="block">
              <span className="label">בית חולים</span>
              <select className="input" value={hospitalId} onChange={(e) => chooseHospital(e.target.value)}>
                {(hospitals.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <label className="block min-w-0">
                <span className="label">תאריך ספירה</span>
                <input
                  type="date"
                  className="input"
                  value={viewed ? viewed.counted_on : date}
                  disabled={!!viewed}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="block min-w-0">
                <span className="label">נספר ע״י</span>
                <p className="input truncate bg-slate-50 text-slate-600">
                  {viewed ? (viewed.counter?.full_name || viewed.counter?.email || '—') : (profile?.full_name || profile?.email || '—')}
                </p>
              </div>
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

          <div
            className={classNames(
              'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm',
              missing.length
                ? 'border-red-200 bg-red-50 text-red-700'
                : counted > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            <p className="font-semibold" role="status">
              {missing.length
                ? `חסרים ${missing.length} פריטים · ${units} יחידות`
                : counted > 0
                  ? 'אין חוסרים'
                  : 'הזן כמויות כדי לראות מה חסר'}
              {counted > 0 && <span className="font-normal text-slate-600"> · נספרו {counted} מתוך {rows.length}</span>}
            </p>
            {missing.length > 0 && (
              <button
                type="button"
                aria-pressed={onlyShortActive}
                onClick={() => setOnlyShort((v) => !v)}
                className={classNames(
                  'chip',
                  onlyShortActive ? 'border-red-400 bg-red-600 text-white' : 'border-red-300 bg-white text-red-700',
                )}
              >
                {onlyShortActive ? 'הצג הכל' : 'חוסרים בלבד'}
              </button>
            )}
          </div>

          {groups.map((g) => {
            const gShort = g.rows.filter((r) => shortageOf(r) > 0).length
            return (
              <section key={g.category} className="card overflow-hidden" aria-label={g.category}>
                <h2 className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <span>{g.category}</span>
                  {gShort > 0 && <span className="chip border-red-200 bg-red-50 text-red-700">{gShort} חסרים</span>}
                </h2>
                <ul className="divide-y divide-slate-100">
                  {g.rows.map((r) => {
                    const short = shortageOf(r)
                    const surplus = r.qty !== null && r.qty > r.min ? r.qty - r.min : 0
                    const nm = r.item.name
                    return (
                      <li
                        key={r.item.id}
                        className={classNames('space-y-2 px-3 py-2.5 lg:flex lg:items-center lg:justify-between lg:gap-4 lg:space-y-0', short > 0 && 'bg-red-50/60')}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2 lg:block lg:flex-1">
                          <div className="min-w-0">
                            <p dir="ltr" className="text-left text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">
                              {nm}
                            </p>
                            {r.item.catalog_number && (
                              <p dir="ltr" className="text-left text-xs text-slate-500">{r.item.catalog_number}</p>
                            )}
                          </div>
                          <span
                            className={classNames(
                              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold lg:hidden',
                              r.qty === null && 'text-slate-500',
                              short > 0 && 'bg-red-100 text-red-700',
                              r.qty !== null && short === 0 && surplus === 0 && 'text-emerald-700',
                              surplus > 0 && 'text-slate-500',
                            )}
                          >
                            {r.qty === null ? '' : short > 0 ? `חסר ${short}` : surplus > 0 ? `+${surplus}` : '✓ תקין'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 lg:justify-end">
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            מינימום
                            {viewed ? (
                              <span className="text-sm text-slate-700">{r.min}</span>
                            ) : (
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label={`מינימום: ${nm}`}
                                className="input !min-h-[36px] !w-16 !px-1 !py-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                value={minv[r.item.id] ?? ''}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setMinv((m) => ({ ...m, [r.item.id]: e.target.value }))}
                              />
                            )}
                          </label>
                          {viewed ? (
                            <span className="text-sm font-semibold text-slate-800">בפועל {r.qty}</span>
                          ) : (
                            <div className="flex items-center gap-1" role="group" aria-label={`כמות בפועל: ${nm}`}>
                              <button type="button" className={STEP_BTN} aria-label={`הפחת: ${nm}`} onClick={() => step(r.item.id, -1)}>
                                <Minus size={18} aria-hidden="true" />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label={`כמות בפועל: ${nm}`}
                                placeholder="—"
                                className="input !min-h-[40px] !w-16 !px-1 !py-1 text-center font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                value={qty[r.item.id] ?? ''}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setQty((m) => ({ ...m, [r.item.id]: e.target.value }))}
                              />
                              <button type="button" className={STEP_BTN} aria-label={`הוסף: ${nm}`} onClick={() => step(r.item.id, 1)}>
                                <Plus size={18} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                          <span
                            className={classNames(
                              'hidden w-20 rounded-lg py-1.5 text-center text-sm font-bold lg:block',
                              r.qty === null && 'text-slate-500',
                              short > 0 && 'bg-red-50 text-red-700',
                              r.qty !== null && short === 0 && surplus === 0 && 'text-emerald-700',
                              surplus > 0 && 'text-slate-500',
                            )}
                          >
                            {r.qty === null ? '—' : short > 0 ? `חסר ${short}` : surplus > 0 ? `+${surplus}` : '✓'}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          {groups.length === 0 && onlyShortActive && (
            <EmptyState title="אין חוסרים" hint="כל הפריטים שנספרו במלאי המינימום או מעליו" />
          )}

          {!viewed && (
            <label className="block">
              <span className="label">הערות לספירה</span>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          )}

          <section className="card space-y-2 p-3">
            <h2 className="font-semibold text-brand-800">שליחת חוסרים במייל</h2>
            <div className="grid grid-cols-3 gap-2">
              {canMail ? (
                <>
                  <a
                    className="btn-secondary !px-2"
                    href={outlookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      setNotice('נפתחה טיוטה ב-Outlook בדפדפן — בדוק אותה ולחץ "שלח". שום דבר לא נשלח לפני כן.')
                    }
                  >
                    <Mail size={16} aria-hidden="true" />
                    Outlook
                  </a>
                  <a className="btn-secondary !px-2" href={mailto.url} onClick={onMailtoClick}>
                    <Mail size={16} aria-hidden="true" />
                    מייל
                  </a>
                </>
              ) : (
                <button className="btn-secondary col-span-2 !px-2" disabled title={to ? 'אין חוסרים' : 'לא הוגדרה כתובת מייל'}>
                  <Mail size={16} aria-hidden="true" />
                  פתח מייל חוסרים
                </button>
              )}
              <button className="btn-secondary !px-2" onClick={copyList} disabled={missing.length === 0}>
                <Copy size={16} aria-hidden="true" />
                העתק
              </button>
            </div>
            {!to && (
              <p className="text-xs text-amber-700">
                לא הוגדרה כתובת מייל לשליחת חוסרים — הגדרה בעמוד{' '}
                <SettingsLink className="font-medium underline">הגדרות ← מתכלים</SettingsLink>.
              </p>
            )}
            {to && missing.length > 0 && !notice && (
              <p className="text-xs text-slate-500">
                הכפתורים פותחים טיוטה בלבד — המייל נשלח רק אחרי שתבדוק ותלחץ "שלח". "מייל" פותח את אפליקציית המייל במכשיר; אם אין כזו, השתמש ב-Outlook.
              </p>
            )}
            {to && missing.length === 0 && <p className="text-xs text-slate-500">אין חוסרים לשלוח.</p>}
          </section>

          {!viewed && hospitalId && (
            <StockForecast
              hospitalId={hospitalId}
              lastCount={counts.data?.[0]}
              minOf={(itemId, fallback) => overrides.get(itemId) ?? fallback}
            />
          )}

          <section className="card p-4">
            <h2 className="mb-2 font-semibold text-brand-800">היסטוריית ספירות</h2>
            {(counts.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">עוד לא בוצעו ספירות בבית חולים זה.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {(counts.data ?? []).map((c) => {
                  const short = c.lines.filter((l) => l.qty < l.min_qty).length
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 text-slate-700">
                        {formatDate(c.counted_on)} <PendingMark id={c.id} />
                        <span className="mr-2 text-xs text-slate-500">
                          {c.counter?.full_name || c.counter?.email || ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={classNames('chip', short ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
                          {short ? `${short} חסרים` : 'תקין'}
                        </span>
                        <button
                          className="btn-ghost !px-2"
                          onClick={() => {
                            setViewId(c.id)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          aria-label={`הצג ספירה מתאריך ${formatDate(c.counted_on)}`}
                        >
                          <Eye size={16} />
                        </button>
                        <ConfirmButton
                          className="btn-ghost !px-2 text-red-500"
                          label={`מחיקת ספירה מתאריך ${formatDate(c.counted_on)}`}
                          onConfirm={() => delCount.mutate(c.id)}
                        >
                          <Trash2 size={16} />
                        </ConfirmButton>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {!viewed && (
            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 card p-2.5 shadow-lg md:bottom-4">
              <div className="flex items-center justify-between gap-3">
                <p className={classNames('min-w-0 text-sm font-semibold', missing.length ? 'text-red-700' : 'text-slate-700')}>
                  {missing.length ? `חסרים ${missing.length} · ${units} יח׳` : counted > 0 ? 'אין חוסרים' : `${rows.length} פריטים`}
                </p>
                <button className="btn-primary shrink-0" onClick={saveCount} disabled={save.isPending}>
                  <Save size={16} aria-hidden="true" />
                  שמור ספירה
                </button>
              </div>
              {notice && <p role="status" className="mt-1.5 text-xs text-slate-600">{notice}</p>}
            </div>
          )}
          {viewed && notice && <p role="status" className="text-xs text-slate-600">{notice}</p>}
        </>
      )}
    </div>
  )
}
