import { useMemo, useState } from 'react'
import { Check, RotateCcw, Shuffle, X } from 'lucide-react'
import { useRecordAnswer, useSaveAttempt } from '../lib/learnApi'
import type { LearnCard, LearnProgress } from '../lib/types'
import { LearnImage } from './LearnMedia'
import { classNames } from '../lib/utils'

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** the content is in English: left-to-right inside the Hebrew page */
const text = 'whitespace-pre-wrap text-left'

/* ---------------------------------------------------------------- flashcards */

export function FlashStudy({ cards, progress, auto, onExit }: { cards: LearnCard[]; progress: LearnProgress[]; auto?: boolean; onExit?: () => void }) {
  const record = useRecordAnswer()
  const byCard = useMemo(() => new Map(progress.map((p) => [p.card_id, p])), [progress])
  const [onlyUnknown, setOnlyUnknown] = useState(true)
  const [mix, setMix] = useState(true)
  const [session, setSession] = useState<{ queue: string[]; total: number; known: number; missed: number } | null>(() =>
    auto ? { queue: shuffle(cards).map((c) => c.id), total: cards.length, known: 0, missed: 0 } : null,
  )
  const [flipped, setFlipped] = useState(false)
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  function start() {
    const pool = cards.filter((c) => !onlyUnknown || !byCard.get(c.id)?.known)
    const ids = (mix ? shuffle(pool) : pool).map((c) => c.id)
    setFlipped(false)
    setSession({ queue: ids, total: ids.length, known: 0, missed: 0 })
  }

  if (cards.length === 0) return <p className="text-sm text-slate-400">אין עדיין שאלות בנושא הזה.</p>

  if (!session) {
    const unknown = cards.filter((c) => !byCard.get(c.id)?.known).length
    return (
      <div className="card space-y-4 p-5">
        <p className="text-sm text-slate-600">
          כרטיסיות הפוך-וזכור: רואים שאלה, חושבים, הופכים לתשובה ומסמנים "ידעתי" או "לא ידעתי". שאלות שלא ידעת חוזרות עד שתדע אותן.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnknown} onChange={(e) => setOnlyUnknown(e.target.checked)} />
          רק שאלות שעוד לא ידעתי ({unknown} מתוך {cards.length})
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} />
          <Shuffle size={14} /> סדר אקראי
        </label>
        <button className="btn-primary" onClick={start} disabled={onlyUnknown && unknown === 0}>
          {onlyUnknown && unknown === 0 ? 'ידעת הכול — בטל את הסינון כדי לחזור' : 'התחל'}
        </button>
      </div>
    )
  }

  const current = session.queue.length ? cardMap.get(session.queue[0]) : null
  if (!current) {
    return (
      <div className="card space-y-3 p-5 text-center">
        <p className="text-lg font-bold text-emerald-700">סיימת את הסבב!</p>
        <p className="text-sm text-slate-500">
          {session.total} שאלות · {session.missed} פעמים שלא ידעת לפני שידעת
        </p>
        <button className="btn-primary" onClick={() => (auto && onExit ? onExit() : setSession(null))}>
          חזרה
        </button>
      </div>
    )
  }

  function answer(correct: boolean) {
    record.mutate({ card: current!, correct, prev: byCard.get(current!.id) })
    setFlipped(false)
    setSession((s) => {
      if (!s) return s
      const [head, ...rest] = s.queue
      // a missed card comes back a few cards later
      const queue = correct ? rest : [...rest.slice(0, 4), head, ...rest.slice(4)]
      return { ...s, queue, known: s.known + (correct ? 1 : 0), missed: s.missed + (correct ? 0 : 1) }
    })
  }

  const done = session.total - new Set(session.queue).size
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          נשארו {new Set(session.queue).size} · נלמדו {done} מתוך {session.total}
        </span>
        <button className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600" onClick={() => (auto && onExit ? onExit() : setSession(null))}>
          <X size={13} /> סיום
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-500" style={{ width: `${session.total ? (done / session.total) * 100 : 0}%` }} />
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={classNames(
          'card flex min-h-56 w-full flex-col justify-center gap-2 p-6 text-left transition',
          flipped ? 'border-emerald-300 bg-emerald-50/50' : 'hover:border-brand-300',
        )}
        dir="ltr"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{flipped ? 'Answer' : 'Question'}</span>
        <span className={classNames(text, 'text-lg leading-relaxed text-slate-800')}>{flipped ? current.answer : current.question}</span>
        {!flipped && current.image_path && <LearnImage path={current.image_path} />}
        {!flipped && <span className="mt-2 text-xs text-slate-400">לחץ כדי להפוך</span>}
      </button>
      {flipped ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary !border-red-200 !text-red-600" onClick={() => answer(false)}>
            <X size={16} /> לא ידעתי
          </button>
          <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" onClick={() => answer(true)}>
            <Check size={16} /> ידעתי
          </button>
        </div>
      ) : (
        <button className="btn-secondary w-full" onClick={() => setFlipped(true)}>
          הצג תשובה
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- multiple-choice quiz */

type Q = { card: LearnCard; options: string[] }

function buildQuiz(cards: LearnCard[], known: Set<string>, count: number): Q[] {
  // unknown cards first, so the quiz practises what is still missing
  const ordered = [...shuffle(cards.filter((c) => !known.has(c.id))), ...shuffle(cards.filter((c) => known.has(c.id)))].slice(0, count)
  return shuffle(ordered).map((card) => {
    const others = shuffle([...new Set(cards.filter((c) => c.id !== card.id && c.answer.trim() !== card.answer.trim()).map((c) => c.answer))]).slice(0, 3)
    return { card, options: shuffle([card.answer, ...others]) }
  })
}

export function QuizStudy({ topicId, cards, progress, passPct }: { topicId: string; cards: LearnCard[]; progress: LearnProgress[]; passPct?: number }) {
  const record = useRecordAnswer()
  const saveAttempt = useSaveAttempt()
  const byCard = useMemo(() => new Map(progress.map((p) => [p.card_id, p])), [progress])
  const [size, setSize] = useState(10)
  const [quiz, setQuiz] = useState<Q[] | null>(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [wrong, setWrong] = useState<Q[]>([])
  const [score, setScore] = useState(0)
  const distinct = new Set(cards.map((c) => c.answer.trim())).size

  if (cards.length === 0) return <p className="text-sm text-slate-400">אין עדיין שאלות בנושא הזה.</p>
  if (distinct < 4) return <p className="text-sm text-slate-400">למבחן אמריקאי צריך לפחות 4 תשובות שונות בנושא.</p>

  if (!quiz) {
    return (
      <div className="card space-y-4 p-5">
        <p className="text-sm text-slate-600">מבחן אמריקאי: שאלה עם 4 תשובות. השאלות שעוד לא ידעת מופיעות קודם. כל תשובה נשמרת בהתקדמות שלך.</p>
        <label className="flex items-center gap-2 text-sm">
          מספר שאלות
          <select className="input !w-auto" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[5, 10, 20, 40].filter((n) => n < cards.length).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={cards.length}>הכול ({cards.length})</option>
          </select>
        </label>
        <button
          className="btn-primary"
          onClick={() => {
            setQuiz(buildQuiz(cards, new Set(progress.filter((p) => p.known).map((p) => p.card_id)), size))
            setI(0)
            setPicked(null)
            setWrong([])
            setScore(0)
          }}
        >
          התחל מבחן
        </button>
      </div>
    )
  }

  if (i >= quiz.length) {
    return (
      <div className="space-y-3">
        <div className="card space-y-1 p-5 text-center">
          <p className="text-3xl font-bold text-slate-800">
            {score}/{quiz.length}
          </p>
          <p className="text-sm text-slate-500">{Math.round((score / quiz.length) * 100)}% נכון</p>
          {passPct !== undefined && (
            <p className={classNames('text-sm font-semibold', Math.round((score / quiz.length) * 100) >= passPct ? 'text-emerald-600' : 'text-red-600')}>
              {Math.round((score / quiz.length) * 100) >= passPct ? `עברת! (ציון עובר ${passPct}%)` : `עוד לא עברת — נדרש ${passPct}%. אפשר לנסות שוב.`}
            </p>
          )}
        </div>
        {wrong.length > 0 && (
          <div className="card space-y-3 p-4">
            <p className="text-sm font-semibold text-slate-700">לחזור על:</p>
            {wrong.map((q) => (
              <div key={q.card.id} dir="ltr" className="border-b border-slate-100 pb-2 text-sm last:border-0">
                <p className={classNames(text, 'font-medium text-slate-800')}>{q.card.question}</p>
                <p className={classNames(text, 'text-emerald-700')}>{q.card.answer}</p>
              </div>
            ))}
          </div>
        )}
        <button
          className="btn-primary w-full"
          onClick={() => {
            setQuiz(null)
          }}
        >
          <RotateCcw size={15} /> מבחן חדש
        </button>
      </div>
    )
  }

  const q = quiz[i]
  const answered = picked !== null

  function choose(option: string) {
    if (answered) return
    const correct = option === q.card.answer
    setPicked(option)
    if (correct) setScore((s) => s + 1)
    else setWrong((w) => [...w, q])
    record.mutate({ card: q.card, correct, prev: byCard.get(q.card.id) })
  }

  function next() {
    if (i + 1 >= quiz!.length) saveAttempt.mutate({ topic_id: topicId, score, total: quiz!.length })
    setI((n) => n + 1)
    setPicked(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          שאלה {i + 1} מתוך {quiz.length}
        </span>
        <span>ניקוד: {score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-brand-500" style={{ width: `${(i / quiz.length) * 100}%` }} />
      </div>
      <div className="card p-5" dir="ltr">
        <p className={classNames(text, 'text-lg leading-relaxed text-slate-800')}>{q.card.question}</p>
        {q.card.image_path && <LearnImage path={q.card.image_path} className="mt-3" />}
      </div>
      <div className="space-y-2" dir="ltr">
        {q.options.map((o) => {
          const isRight = o === q.card.answer
          return (
            <button
              key={o}
              type="button"
              onClick={() => choose(o)}
              disabled={answered}
              className={classNames(
                'w-full rounded-xl border px-4 py-3 text-sm transition',
                text,
                !answered && 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50',
                answered && isRight && 'border-emerald-400 bg-emerald-50 text-emerald-800',
                answered && !isRight && o === picked && 'border-red-400 bg-red-50 text-red-700',
                answered && !isRight && o !== picked && 'border-slate-200 bg-white text-slate-400',
              )}
            >
              {o}
            </button>
          )
        })}
      </div>
      {answered && (
        <button className="btn-primary w-full" onClick={next}>
          {i + 1 >= quiz.length ? 'סיום וצפייה בציון' : 'הבאה'}
        </button>
      )}
    </div>
  )
}
