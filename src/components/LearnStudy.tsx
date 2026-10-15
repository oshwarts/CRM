import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, RotateCcw, Shuffle, X } from 'lucide-react'
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
        {flipped && current.explanation && <span className={classNames(text, 'text-sm text-slate-500')}>{current.explanation}</span>}
        {!flipped && current.image_path && <LearnImage path={current.image_path} />}
        {!flipped && <span className="mt-2 text-xs text-slate-400">לחץ כדי להפוך</span>}
      </button>
      {flipped ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary !border-red-200 !text-red-600" onClick={() => answer(false)}>
            <X size={16} /> לא ידעתי
          </button>
          <button className="btn-primary !bg-[#1d9a6c] hover:!bg-[#17805a]" onClick={() => answer(true)}>
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
    // the wrong answers written with the question; otherwise answers of other questions of the topic
    const own = (card.wrong_options ?? []).filter((w) => w.trim() && w.trim() !== card.answer.trim())
    const others = own.length >= 3
      ? own.slice(0, 3)
      : [...own, ...shuffle([...new Set(cards.filter((c) => c.id !== card.id && c.answer.trim() !== card.answer.trim() && !own.includes(c.answer)).map((c) => c.answer))])].slice(0, 3)
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
  // the chosen answer of each question (null = not answered yet): the student can jump forward and back
  const [picks, setPicks] = useState<(string | null)[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [finished, setFinished] = useState(false)
  const distinct = new Set(cards.map((c) => c.answer.trim())).size

  if (cards.length === 0) return <p className="text-sm text-slate-400">אין עדיין שאלות בנושא הזה.</p>
  if (distinct < 4) return <p className="text-sm text-slate-400">למבחן אמריקאי צריך לפחות 4 תשובות שונות בנושא.</p>

  if (!quiz) {
    return (
      <div className="card space-y-4 p-5">
        <p className="text-sm text-slate-600">
          מבחן אמריקאי: שאלה עם 4 תשובות. אפשר לדלג על שאלה, לחזור אחורה, ובסוף לחזור לשאלות שלא נענו. השאלות שעוד לא ידעת מופיעות קודם. כל תשובה נשמרת בהתקדמות שלך.
        </p>
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
            const q = buildQuiz(cards, new Set(progress.filter((p) => p.known).map((p) => p.card_id)), size)
            setQuiz(q)
            setPicks(q.map(() => null))
            setI(0)
            setReviewing(false)
            setFinished(false)
          }}
        >
          התחל מבחן
        </button>
      </div>
    )
  }

  const total = quiz.length
  const isRight = (k: number) => picks[k] !== null && picks[k] === quiz[k].card.answer
  const score = quiz.reduce((n, _, k) => n + (isRight(k) ? 1 : 0), 0)
  const unanswered = quiz.map((_, k) => k).filter((k) => picks[k] === null)

  function finish() {
    setFinished(true)
    setReviewing(false)
    saveAttempt.mutate({ topic_id: topicId, picks: quiz!.map((q, k) => ({ card_id: q.card.id, answer: picks[k] })) })
  }

  if (finished) {
    const missed = quiz.filter((_, k) => !isRight(k))
    const pct = Math.round((score / total) * 100)
    return (
      <div className="space-y-3">
        <div className="card space-y-1 p-5 text-center">
          <p className="text-3xl font-bold text-slate-800">
            {score}/{total}
          </p>
          <p className="text-sm text-slate-500">{pct}% נכון{unanswered.length > 0 ? ` · ${unanswered.length} לא נענו` : ''}</p>
          {passPct !== undefined && (
            <p className={classNames('text-sm font-semibold', pct >= passPct ? 'text-emerald-600' : 'text-red-600')}>
              {pct >= passPct ? `עברת! (ציון עובר ${passPct}%)` : `עוד לא עברת — נדרש ${passPct}%. אפשר לנסות שוב.`}
            </p>
          )}
        </div>
        {missed.length > 0 && (
          <div className="card space-y-3 p-4">
            <p className="text-sm font-semibold text-slate-700">לחזור על:</p>
            {missed.map((q) => (
              <div key={q.card.id} dir="ltr" className="border-b border-slate-100 pb-2 text-sm last:border-0">
                <p className={classNames(text, 'font-medium text-slate-800')}>{q.card.question}</p>
                <p className={classNames(text, 'text-emerald-700')}>{q.card.answer}</p>
              </div>
            ))}
          </div>
        )}
        <button className="btn-primary w-full" onClick={() => setQuiz(null)}>
          <RotateCcw size={15} /> מבחן חדש
        </button>
      </div>
    )
  }

  /** the numbered strip: where am I, what is answered, what was skipped */
  const strip = (
    <div className="flex flex-wrap gap-1" dir="ltr">
      {quiz.map((_, k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            setI(k)
            setReviewing(false)
          }}
          aria-label={`שאלה ${k + 1}`}
          className={classNames(
            'h-7 w-7 rounded-lg border text-xs font-medium transition',
            !reviewing && k === i && 'ring-2 ring-brand-500 ring-offset-1',
            picks[k] === null ? 'border-slate-200 bg-white text-slate-500' : isRight(k) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600',
          )}
        >
          {k + 1}
        </button>
      ))}
    </div>
  )

  if (reviewing) {
    return (
      <div className="space-y-3">
        {strip}
        <div className="card space-y-3 p-5 text-center">
          {unanswered.length > 0 ? (
            <>
              <p className="text-lg font-semibold text-amber-700">נשארו {unanswered.length} שאלות שלא נענו</p>
              <p className="text-sm text-slate-500">שאלה: {unanswered.map((k) => k + 1).join(', ')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  className="btn-primary"
                  onClick={() => {
                    setI(unanswered[0])
                    setReviewing(false)
                  }}
                >
                  חזור לשאלות שלא נענו
                </button>
                <button className="btn-secondary" onClick={finish}>
                  סיים בכל זאת
                </button>
              </div>
              <p className="text-xs text-slate-400">שאלה שלא נענתה נספרת כטעות בציון.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-emerald-700">ענית על כל השאלות</p>
              <button className="btn-primary" onClick={finish}>
                סיום וצפייה בציון
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const q = quiz[i]
  const picked = picks[i]
  const answered = picked !== null

  function choose(option: string) {
    if (answered) return
    const correct = option === q.card.answer
    setPicks((x) => x.map((v, k) => (k === i ? option : v)))
    record.mutate({ card: q.card, correct, prev: byCard.get(q.card.id) })
  }

  const last = i === total - 1
  // forward: the next question; from the last one — the review of what is left (or the finish)
  const forward = () => (last ? setReviewing(true) : setI(i + 1))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          שאלה {i + 1} מתוך {total} · נענו {total - unanswered.length}
        </span>
        <span>ניקוד: {score}</span>
      </div>
      {strip}
      <div className="card p-5" dir="ltr">
        <p className={classNames(text, 'text-lg leading-relaxed text-slate-800')}>{q.card.question}</p>
        {q.card.image_path && <LearnImage path={q.card.image_path} className="mt-3" />}
      </div>
      <div className="space-y-2" dir="ltr">
        {q.options.map((o) => {
          const right = o === q.card.answer
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
                answered && right && 'border-emerald-400 bg-emerald-50 text-emerald-800',
                answered && !right && o === picked && 'border-red-400 bg-red-50 text-red-700',
                answered && !right && o !== picked && 'border-slate-200 bg-white text-slate-400',
              )}
            >
              {o}
            </button>
          )
        })}
      </div>
      {answered && q.card.explanation && (
        <p dir="ltr" className={classNames(text, 'rounded-xl bg-slate-50 p-3 text-sm text-slate-600')}>
          {q.card.explanation}
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronRight size={16} /> הקודמת
        </button>
        <button className={answered ? 'btn-primary flex-1' : 'btn-secondary flex-1'} onClick={forward}>
          {last ? (unanswered.length > 0 ? 'לסיכום ולשאלות שנשארו' : 'סיום וצפייה בציון') : answered ? 'הבאה' : 'דלג'}
          {!last && <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  )
}
