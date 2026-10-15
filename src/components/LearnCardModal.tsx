import { useState } from 'react'
import { useSaveCard } from '../lib/learnApi'
import type { LearnCard, LearnLesson } from '../lib/types'
import { LearnImage } from './LearnMedia'
import { Field, Modal } from './ui'

/** add or edit one question: the answer, its wrong answers (for the multiple-choice quiz), an explanation and an image */
export function LearnCardModal({
  topicId,
  card,
  lessons,
  defaultLessonId,
  onClose,
}: {
  topicId: string
  card: LearnCard | null
  lessons?: LearnLesson[]
  defaultLessonId?: string | null
  onClose: () => void
}) {
  const save = useSaveCard()
  const [q, setQ] = useState(card?.question ?? '')
  const [a, setA] = useState(card?.answer ?? '')
  const [wrong, setWrong] = useState<string[]>(() => [...(card?.wrong_options ?? []), '', '', ''].slice(0, 3))
  const [explanation, setExplanation] = useState(card?.explanation ?? '')
  const [lessonId, setLessonId] = useState<string>(card ? (card.lesson_id ?? '') : (defaultLessonId ?? ''))
  const [image, setImage] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal open onClose={onClose} title={card ? 'עריכת שאלה' : 'שאלה חדשה'} size="lg">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(
            { id: card?.id, topic_id: topicId, question: q, answer: a, wrong_options: wrong, explanation, lesson_id: lessonId || null, sort: 999999, image, removeImage, existingImage: card?.image_path },
            { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'השמירה נכשלה') },
          )
        }}
      >
        {lessons && lessons.length > 0 && (
          <Field label="שיעור קשור">
            <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">שאלה כללית בנושא (לא קשורה לשיעור)</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="שאלה">
          <textarea className="input min-h-20" dir="auto" required value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label="תמונה לשאלה (אופציונלי, למשל צילום רנטגן)">
          {card?.image_path && !removeImage && (
            <div className="mb-1 space-y-1">
              <LearnImage path={card.image_path} className="max-h-32" />
              <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setRemoveImage(true)}>
                הסר תמונה
              </button>
            </div>
          )}
          <input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="התשובה הנכונה">
          <textarea className="input min-h-16 !border-emerald-300" dir="auto" required value={a} onChange={(e) => setA(e.target.value)} />
        </Field>
        <Field label="תשובות שגויות למבחן האמריקאי (אופציונלי — בלי זה יילקחו תשובות משאלות אחרות בנושא)">
          <div className="space-y-1.5">
            {wrong.map((w, i) => (
              <input key={i} className="input" dir="auto" value={w} onChange={(e) => setWrong((x) => x.map((v, k) => (k === i ? e.target.value : v)))} aria-label={`תשובה שגויה ${i + 1}`} />
            ))}
          </div>
        </Field>
        <Field label="הסבר (מוצג אחרי התשובה)">
          <textarea className="input min-h-16" dir="auto" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">שאלה שנכתבת או נערכת על ידי עורך תוכן מתפרסמת רק אחרי שמנהל מאשר אותה.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" disabled={!q.trim() || !a.trim() || save.isPending}>
            שמור
          </button>
        </div>
      </form>
    </Modal>
  )
}
