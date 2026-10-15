import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useApprove, useCanEditLearning, useCases, useDeleteCase, useDeleteLesson, useLessons, useSaveCase, useSaveLesson } from '../lib/learnApi'
import type { LearnCase, LearnLesson } from '../lib/types'
import { LearnImage, VideoLink } from './LearnMedia'
import { ConfirmButton, EmptyState, Field, Modal, Spinner } from './ui'
import { classNames } from '../lib/utils'

/** the "waiting for approval" tag, with the manager's approve button */
export function ApprovalTag({ approved, table, id, topicId, label }: { approved: boolean; table: 'learn_cards' | 'learn_lessons' | 'learn_cases'; id: string; topicId: string; label: string }) {
  const { isAdmin } = useAuth()
  const approve = useApprove()
  if (approved) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-[11px] text-amber-700">ממתין לאישור</span>
      {isAdmin && (
        <button className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] text-white hover:bg-emerald-700" onClick={() => approve.mutate([{ table, id, topic_id: topicId, label }])}>
          <Check size={11} /> אשר
        </button>
      )}
    </span>
  )
}

/* ---------------------------------------------------------------- lessons */

function LessonModal({ topicId, lesson, nextSort, onClose }: { topicId: string; lesson: LearnLesson | null; nextSort: number; onClose: () => void }) {
  const save = useSaveLesson()
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [body, setBody] = useState(lesson?.body ?? '')
  const [video, setVideo] = useState(lesson?.video_url ?? '')
  const [image, setImage] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal open onClose={onClose} title={lesson ? 'עריכת שיעור' : 'שיעור חדש'} size="xl">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(
            { id: lesson?.id, topic_id: topicId, title, body, video_url: video, sort: lesson?.sort ?? nextSort, image, removeImage, existingImage: lesson?.image_path },
            { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'השמירה נכשלה') },
          )
        }}
      >
        <Field label="כותרת">
          <input className="input" dir="auto" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="תוכן השיעור">
          <textarea className="input min-h-40" dir="auto" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="תמונה (אופציונלי)">
          {lesson?.image_path && !removeImage && (
            <div className="mb-1 space-y-1">
              <LearnImage path={lesson.image_path} className="max-h-32" />
              <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setRemoveImage(true)}>
                הסר תמונה
              </button>
            </div>
          )}
          <input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="קישור לוידאו (YouTube או כל קישור)">
          <input className="input" dir="ltr" placeholder="https://…" value={video} onChange={(e) => setVideo(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">שיעור שנכתב על ידי עורך תוכן מתפרסם רק אחרי שמנהל מאשר אותו.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" disabled={!title.trim() || save.isPending}>
            {save.isPending ? 'שומר…' : 'שמור'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** short lessons with text, a picture and a video — read before the questions of the topic */
export function LessonsPanel({ topicId }: { topicId: string }) {
  const lessons = useLessons(topicId)
  const canEdit = useCanEditLearning()
  const del = useDeleteLesson()
  const [open, setOpen] = useState<string | null>(null)
  const [modal, setModal] = useState<{ lesson: LearnLesson | null } | null>(null)
  if (lessons.isLoading) return <Spinner />
  const list = lessons.data ?? []
  return (
    <div className="space-y-3">
      {canEdit && (
        <button className="btn-secondary" onClick={() => setModal({ lesson: null })}>
          <Plus size={15} /> שיעור
        </button>
      )}
      {list.length === 0 ? (
        <EmptyState title="אין עדיין שיעורים בנושא הזה" hint={canEdit ? 'הוסף שיעור קצר עם טקסט, תמונה או וידאו' : undefined} />
      ) : (
        <ul className="space-y-2">
          {list.map((l, i) => {
            const isOpen = open === l.id
            return (
              <li key={l.id} className="card overflow-hidden">
                <button className="flex w-full items-center justify-between gap-2 p-3 text-right" onClick={() => setOpen(isOpen ? null : l.id)}>
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs text-brand-700">{i + 1}</span>
                    {l.title}
                    <ApprovalTag approved={l.approved} table="learn_lessons" id={l.id} topicId={topicId} label={l.title} />
                  </span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-slate-100 p-4">
                    {l.body && (
                      <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {l.body}
                      </p>
                    )}
                    <LearnImage path={l.image_path} />
                    <VideoLink url={l.video_url} />
                    {canEdit && (
                      <div className="flex gap-1">
                        <button className="btn-ghost !px-2" aria-label="עריכה" onClick={() => setModal({ lesson: l })}>
                          <Pencil size={14} />
                        </button>
                        <ConfirmButton className="btn-ghost !px-2 text-red-500" message="למחוק את השיעור?" onConfirm={() => del.mutate(l.id)}>
                          <Trash2 size={14} />
                        </ConfirmButton>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {modal && <LessonModal topicId={topicId} lesson={modal.lesson} nextSort={list.length} onClose={() => setModal(null)} />}
    </div>
  )
}

/* ---------------------------------------------------------------- clinical cases */

function CaseModal({ topicId, item, nextSort, onClose }: { topicId: string; item: LearnCase | null; nextSort: number; onClose: () => void }) {
  const save = useSaveCase()
  const [title, setTitle] = useState(item?.title ?? '')
  const [scenario, setScenario] = useState(item?.scenario ?? '')
  const [question, setQuestion] = useState(item?.question ?? '')
  const [options, setOptions] = useState<string[]>(() => {
    const o = item?.options ?? []
    return [...o, '', '', '', ''].slice(0, Math.max(4, o.length))
  })
  const [correct, setCorrect] = useState(item?.correct_index ?? 0)
  const [explanation, setExplanation] = useState(item?.explanation ?? '')
  const [image, setImage] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [error, setError] = useState('')
  const filled = options.filter((o) => o.trim()).length
  return (
    <Modal open onClose={onClose} title={item ? 'עריכת מקרה קליני' : 'מקרה קליני חדש'} size="xl">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          // the right answer is given by its position among the filled options
          const idx = options.slice(0, correct).filter((o) => o.trim()).length
          save.mutate(
            { id: item?.id, topic_id: topicId, title, scenario, question, options, correct_index: idx, explanation, sort: item?.sort ?? nextSort, image, removeImage, existingImage: item?.image_path },
            { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'השמירה נכשלה') },
          )
        }}
      >
        <Field label="כותרת המקרה">
          <input className="input" dir="auto" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="תיאור המקרה (מטופל, ממצאים, מה ידוע)">
          <textarea className="input min-h-28" dir="auto" value={scenario} onChange={(e) => setScenario(e.target.value)} />
        </Field>
        <Field label="תמונה (צילום רנטגן, תוכנית…)">
          {item?.image_path && !removeImage && (
            <div className="mb-1 space-y-1">
              <LearnImage path={item.image_path} className="max-h-32" />
              <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setRemoveImage(true)}>
                הסר תמונה
              </button>
            </div>
          )}
          <input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="השאלה">
          <input className="input" dir="auto" required value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <Field label="תשובות (סמן את הנכונה)">
          <div className="space-y-1.5">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label="התשובה הנכונה" />
                <input className="input" dir="auto" value={o} onChange={(e) => setOptions((x) => x.map((v, k) => (k === i ? e.target.value : v)))} />
              </div>
            ))}
            <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setOptions((x) => [...x, ''])}>
              + תשובה
            </button>
          </div>
        </Field>
        <Field label="הסבר (מוצג אחרי הבחירה)">
          <textarea className="input min-h-20" dir="auto" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" disabled={!title.trim() || !question.trim() || filled < 2 || !options[correct]?.trim() || save.isPending}>
            {save.isPending ? 'שומר…' : 'שמור'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CaseCard({ c, topicId, onEdit }: { c: LearnCase; topicId: string; onEdit?: () => void }) {
  const del = useDeleteCase()
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null
  return (
    <li className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
          {c.title}
          <ApprovalTag approved={c.approved} table="learn_cases" id={c.id} topicId={topicId} label={c.title} />
        </h3>
        {onEdit && (
          <span className="flex shrink-0 gap-1">
            <button className="btn-ghost !px-1.5" aria-label="עריכה" onClick={onEdit}>
              <Pencil size={14} />
            </button>
            <ConfirmButton className="btn-ghost !px-1.5 text-red-500" message="למחוק את המקרה?" onConfirm={() => del.mutate(c.id)}>
              <Trash2 size={14} />
            </ConfirmButton>
          </span>
        )}
      </div>
      {c.scenario && (
        <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {c.scenario}
        </p>
      )}
      <LearnImage path={c.image_path} />
      <p dir="auto" className="font-medium text-slate-800">
        {c.question}
      </p>
      <div className="space-y-2">
        {c.options.map((o, i) => (
          <button
            key={i}
            type="button"
            disabled={answered}
            onClick={() => setPicked(i)}
            className={classNames(
              'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-sm transition',
              !answered && 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50',
              answered && i === c.correct_index && 'border-emerald-400 bg-emerald-50 text-emerald-800',
              answered && i !== c.correct_index && i === picked && 'border-red-400 bg-red-50 text-red-700',
              answered && i !== c.correct_index && i !== picked && 'border-slate-200 text-slate-400',
            )}
          >
            {answered && i === c.correct_index && <Check size={14} />}
            {answered && i === picked && i !== c.correct_index && <X size={14} />}
            <span dir="auto">{o}</span>
          </button>
        ))}
      </div>
      {answered && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className={classNames('font-semibold', picked === c.correct_index ? 'text-emerald-700' : 'text-red-600')}>{picked === c.correct_index ? 'נכון!' : 'לא נכון'}</p>
          {c.explanation && (
            <p dir="auto" className="mt-1 whitespace-pre-wrap text-slate-600">
              {c.explanation}
            </p>
          )}
          <button className="mt-2 text-xs text-brand-600 hover:underline" onClick={() => setPicked(null)}>
            נסה שוב
          </button>
        </div>
      )}
    </li>
  )
}

/** clinical cases: a scenario, a decision question with explanation */
export function CasesPanel({ topicId }: { topicId: string }) {
  const cases = useCases(topicId)
  const canEdit = useCanEditLearning()
  const [modal, setModal] = useState<{ item: LearnCase | null } | null>(null)
  if (cases.isLoading) return <Spinner />
  const list = cases.data ?? []
  return (
    <div className="space-y-3">
      {canEdit && (
        <button className="btn-secondary" onClick={() => setModal({ item: null })}>
          <Plus size={15} /> מקרה קליני
        </button>
      )}
      {list.length === 0 ? (
        <EmptyState title="אין עדיין מקרים קליניים בנושא הזה" hint={canEdit ? 'הוסף תרחיש עם שאלת החלטה והסבר' : undefined} />
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <CaseCard key={c.id} c={c} topicId={topicId} onEdit={canEdit ? () => setModal({ item: c }) : undefined} />
          ))}
        </ul>
      )}
      {modal && <CaseModal topicId={topicId} item={modal.item} nextSort={list.length} onClose={() => setModal(null)} />}
    </div>
  )
}
