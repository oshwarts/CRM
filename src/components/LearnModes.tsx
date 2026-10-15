import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, RotateCcw, X } from 'lucide-react'
import { useAddPoints, useRecordAnswer } from '../lib/learnApi'
import { POINTS } from '../lib/learnGame'
import { buildCloze, buildMatchRound, buildTrueFalse, shuffle, type ClozeItem, type TFItem } from '../lib/learnModes'
import type { LearnCard, LearnProgress, LearnSequence } from '../lib/types'
import { LearnImage } from './LearnMedia'
import { classNames } from '../lib/utils'

const text = 'whitespace-pre-wrap text-left'

function Intro({ title, body, onStart, disabled, hint }: { title: string; body: string; onStart: () => void; disabled?: boolean; hint?: string }) {
  return (
    <div className="card space-y-3 p-5">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="text-sm text-slate-600">{body}</p>
      {hint && <p className="text-sm text-amber-600">{hint}</p>}
      <button className="btn-primary" onClick={onStart} disabled={disabled}>
        התחל
      </button>
    </div>
  )
}

function Result({ score, total, onAgain }: { score: number; total: number; onAgain: () => void }) {
  return (
    <div className="card space-y-2 p-5 text-center">
      <p className="text-3xl font-bold text-slate-800">
        {score}/{total}
      </p>
      <p className="text-sm text-slate-500">{total ? Math.round((score / total) * 100) : 0}% נכון</p>
      <button className="btn-primary" onClick={onAgain}>
        <RotateCcw size={15} /> עוד סבב
      </button>
    </div>
  )
}

function Bar({ i, total, score }: { i: number; total: number; score: number }) {
  return (
    <>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {Math.min(i + 1, total)} מתוך {total}
        </span>
        <span>ניקוד: {score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-500" style={{ width: `${(i / total) * 100}%` }} />
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- true / false */

export function TrueFalseStudy({ cards, progress }: { cards: LearnCard[]; progress: LearnProgress[] }) {
  const record = useRecordAnswer()
  const byCard = useMemo(() => new Map(progress.map((p) => [p.card_id, p])), [progress])
  const [items, setItems] = useState<TFItem[] | null>(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)

  if (cards.length < 2) return <p className="text-sm text-slate-400">צריך לפחות שתי שאלות בנושא.</p>
  if (!items)
    return <Intro title="נכון או לא נכון" body="מוצגת שאלה עם תשובה אפשרית. החלט אם התשובה נכונה. מהיר, וטוב לחזרה לפני פגישה." onStart={() => { setItems(buildTrueFalse(cards, Math.min(15, cards.length))); setI(0); setPicked(null); setScore(0) }} />
  if (i >= items.length) return <Result score={score} total={items.length} onAgain={() => setItems(null)} />

  const it = items[i]
  const answered = picked !== null
  const choose = (v: boolean) => {
    if (answered) return
    const right = v === it.truth
    setPicked(v)
    if (right) setScore((s) => s + 1)
    record.mutate({ card: it.card, correct: right, prev: byCard.get(it.card.id) })
  }
  return (
    <div className="space-y-3">
      <Bar i={i} total={items.length} score={score} />
      <div className="card space-y-3 p-5" dir="ltr">
        <p className={classNames(text, 'text-lg leading-relaxed text-slate-800')}>{it.card.question}</p>
        {it.card.image_path && <LearnImage path={it.card.image_path} />}
        <p className={classNames(text, 'rounded-lg bg-slate-50 p-3 text-slate-700')}>{it.shown}</p>
      </div>
      {!answered ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary !border-red-200 !py-3 !text-red-600" onClick={() => choose(false)}>
            <X size={16} /> לא נכון
          </button>
          <button className="btn-primary !bg-emerald-600 !py-3 hover:!bg-emerald-700" onClick={() => choose(true)}>
            <Check size={16} /> נכון
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className={classNames('text-center font-semibold', picked === it.truth ? 'text-emerald-600' : 'text-red-600')}>{picked === it.truth ? 'נכון!' : 'לא נכון'}</p>
          {!it.truth && (
            <p dir="ltr" className={classNames(text, 'rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800')}>
              {it.card.answer}
            </p>
          )}
          {it.card.explanation && (
            <p dir="ltr" className={classNames(text, 'rounded-lg bg-slate-50 p-3 text-sm text-slate-600')}>
              {it.card.explanation}
            </p>
          )}
          <button className="btn-primary w-full" onClick={() => { setI((n) => n + 1); setPicked(null) }}>
            {i + 1 >= items.length ? 'סיום' : 'הבאה'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- fill in the blank */

export function ClozeStudy({ cards, progress }: { cards: LearnCard[]; progress: LearnProgress[] }) {
  const record = useRecordAnswer()
  const byCard = useMemo(() => new Map(progress.map((p) => [p.card_id, p])), [progress])
  const [items, setItems] = useState<ClozeItem[] | null>(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const possible = useMemo(() => buildCloze(cards, 1000).length, [cards])

  if (!items)
    return (
      <Intro
        title="השלמת מילה חסרה"
        body="מוצגת שאלה והתשובה שלה עם חור: מספר, מונח או מילה חשובה חסרים. בחר מה מתאים. כך זוכרים את הפרטים המדויקים."
        hint={possible < 3 ? 'אין מספיק תשובות עם מספרים או מונחים כדי ליצור תרגיל. הוסף שאלות עם תשובות מלאות.' : `אפשר ליצור ${possible} תרגילים מהשאלות בנושא.`}
        disabled={possible < 3}
        onStart={() => { setItems(buildCloze(cards, 12)); setI(0); setPicked(null); setScore(0) }}
      />
    )
  if (i >= items.length) return <Result score={score} total={items.length} onAgain={() => setItems(null)} />

  const it = items[i]
  const answered = picked !== null
  const choose = (o: string) => {
    if (answered) return
    const right = o === it.correct
    setPicked(o)
    if (right) setScore((s) => s + 1)
    record.mutate({ card: it.card, correct: right, prev: byCard.get(it.card.id) })
  }
  const [before, after] = it.text.split('_____')
  return (
    <div className="space-y-3">
      <Bar i={i} total={items.length} score={score} />
      <div className="card space-y-3 p-5" dir="ltr">
        <p className={classNames(text, 'text-sm font-medium text-slate-500')}>{it.card.question}</p>
        <p className={classNames(text, 'text-lg leading-relaxed text-slate-800')}>
          {before}
          <span className={classNames('rounded px-1.5', !answered ? 'bg-amber-100 text-amber-700' : picked === it.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700')}>{answered ? it.correct : '_____'}</span>
          {after}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" dir="ltr">
        {it.options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={answered}
            onClick={() => choose(o)}
            className={classNames(
              'rounded-xl border px-3 py-2.5 text-sm transition',
              !answered && 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50',
              answered && o === it.correct && 'border-emerald-400 bg-emerald-50 text-emerald-800',
              answered && o !== it.correct && o === picked && 'border-red-400 bg-red-50 text-red-700',
              answered && o !== it.correct && o !== picked && 'border-slate-200 text-slate-400',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {answered && (
        <button className="btn-primary w-full" onClick={() => { setI((n) => n + 1); setPicked(null) }}>
          {i + 1 >= items.length ? 'סיום' : 'הבאה'}
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- matching */

export function MatchStudy({ cards, progress }: { cards: LearnCard[]; progress: LearnProgress[] }) {
  const record = useRecordAnswer()
  const points = useAddPoints()
  const byCard = useMemo(() => new Map(progress.map((p) => [p.card_id, p])), [progress])
  const [round, setRound] = useState<LearnCard[] | null>(null)
  const [right, setRight] = useState<LearnCard[]>([])
  const [left, setLeft] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [slipped, setSlipped] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)

  function start() {
    const r = buildMatchRound(cards, 5)
    setRound(r)
    setRight(shuffle(r))
    setLeft(null)
    setDone(new Set())
    setSlipped(new Set())
  }

  if (cards.length < 3) return <p className="text-sm text-slate-400">צריך לפחות שלוש שאלות בנושא.</p>
  if (!round) return <Intro title="התאמה" body="לחץ על שאלה ואז על התשובה שמתאימה לה. כל סבב כולל כמה זוגות. אפשר להתאים בכל סדר." onStart={start} />

  const finished = done.size === round.length
  const pickRight = (c: LearnCard) => {
    if (!left || done.has(c.id)) return
    const ok = left === c.id
    if (ok) {
      const nd = new Set(done).add(c.id)
      setDone(nd)
      // a pair matched without a slip counts as known; one that needed a retry counts as missed
      const card = round.find((x) => x.id === c.id)!
      record.mutate({ card, correct: !slipped.has(c.id), prev: byCard.get(c.id) })
      if (nd.size === round.length) points.mutate({ points: POINTS.round, answers: 0, correct: 0 })
    } else {
      setSlipped((s) => new Set(s).add(left))
      setFlash(c.id)
      setTimeout(() => setFlash(null), 500)
    }
    setLeft(null)
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          הותאמו {done.size} מתוך {round.length}
        </span>
        <span>טעויות: {slipped.size}</span>
      </div>
      <div className="grid grid-cols-2 gap-2" dir="ltr">
        <div className="space-y-2">
          {round.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={done.has(c.id)}
              onClick={() => setLeft(c.id)}
              className={classNames('w-full rounded-xl border p-2.5 text-left text-xs leading-snug transition', done.has(c.id) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : left === c.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300')}
            >
              {c.question}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={done.has(c.id) || !left}
              onClick={() => pickRight(c)}
              className={classNames(
                'w-full rounded-xl border p-2.5 text-left text-xs leading-snug transition',
                done.has(c.id) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : flash === c.id ? 'border-red-400 bg-red-50' : left ? 'border-slate-200 bg-white hover:border-brand-300' : 'border-slate-100 bg-slate-50 text-slate-500',
              )}
            >
              {c.answer}
            </button>
          ))}
        </div>
      </div>
      {finished && (
        <div className="card space-y-2 p-4 text-center">
          <p className="font-semibold text-emerald-700">כל הזוגות הותאמו!</p>
          <button className="btn-primary" onClick={start}>
            <RotateCcw size={15} /> סבב חדש
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- the right order */

export function SequenceStudy({ sequences }: { sequences: LearnSequence[] }) {
  const points = useAddPoints()
  const [current, setCurrent] = useState<{ seq: LearnSequence; order: string[] } | null>(null)
  const [checked, setChecked] = useState(false)

  if (sequences.length === 0) return <p className="text-sm text-slate-400">אין עדיין תרגילי סדר בנושא הזה.</p>
  if (!current)
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-500">סדר את השלבים בסדר הנכון: בחר תרגיל, הזז שלבים למעלה ולמטה ולחץ "בדוק".</p>
        <ul className="space-y-2">
          {sequences.map((s) => (
            <li key={s.id}>
              <button
                className="card flex w-full items-center justify-between p-3 text-right transition hover:border-brand-300"
                onClick={() => {
                  // never start already in the right order
                  let order = shuffle(s.steps)
                  for (let k = 0; k < 5 && order.join('|') === s.steps.join('|') && s.steps.length > 1; k++) order = shuffle(s.steps)
                  setCurrent({ seq: s, order })
                  setChecked(false)
                }}
              >
                <span dir="auto" className="font-medium text-slate-800">
                  {s.title}
                </span>
                <span className="text-xs text-slate-400">{s.steps.length} שלבים</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  const { seq, order } = current
  const correctAt = (i: number) => order[i] === seq.steps[i]
  const allRight = order.every((_, i) => correctAt(i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setCurrent({ seq, order: next })
    setChecked(false)
  }
  return (
    <div className="space-y-3">
      <p dir="auto" className="font-semibold text-slate-800">
        {seq.title}
      </p>
      <ol className="space-y-1.5">
        {order.map((st, i) => (
          <li
            key={`${st}-${i}`}
            className={classNames('flex items-center gap-2 rounded-xl border p-2 text-sm', checked ? (correctAt(i) ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-slate-200 bg-white')}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs text-slate-500">{i + 1}</span>
            <span dir="auto" className="min-w-0 flex-1 whitespace-pre-wrap">
              {st}
            </span>
            <span className="flex shrink-0 flex-col">
              <button className="btn-ghost !px-1 !py-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label="למעלה">
                <ArrowUp size={14} />
              </button>
              <button className="btn-ghost !px-1 !py-0" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="למטה">
                <ArrowDown size={14} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      {checked && (
        <div className="space-y-1">
          <p className={classNames('text-center font-semibold', allRight ? 'text-emerald-600' : 'text-red-600')}>{allRight ? 'הסדר נכון!' : 'יש שלבים שלא במקומם'}</p>
          {!allRight && (
            <ol className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {seq.steps.map((st, i) => (
                <li key={i} dir="auto" className="whitespace-pre-wrap">
                  {i + 1}. {st}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          onClick={() => {
            setChecked(true)
            const right = order.filter((_, i) => correctAt(i)).length
            points.mutate({ points: right === order.length ? POINTS.correct * 2 : POINTS.tried, answers: 1, correct: right === order.length ? 1 : 0 })
          }}
        >
          בדוק
        </button>
        <button className="btn-secondary" onClick={() => setCurrent(null)}>
          חזרה לרשימה
        </button>
      </div>
    </div>
  )
}
