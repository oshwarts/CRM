import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpenText, Check, ChevronDown, ChevronUp, FileText, Pencil, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { openInfoDocument, useInfoCategories, useInfoDocuments, useSaveInfoDoc } from '../lib/api'
import { useApprove, useCanEditLearning, useCases, useDeleteCard, useDeleteCase, useDeleteLesson, useLearnCards, useLessons, useSaveCase, useSaveLesson } from '../lib/learnApi'
import type { InfoDocument, LearnCard, LearnCase, LearnLesson } from '../lib/types'
import { DocReader } from './DocReader'
import { GenerateQuestions } from './GenerateQuestions'
import { LearnCardModal } from './LearnCardModal'
import { DuplicateWarning } from './DuplicateWarning'
import { fileHash, findSimilarDocs, type DupMatch } from '../lib/docDuplicates'
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
  const infoDocs = useInfoDocuments()
  const categories = useInfoCategories()
  const saveDoc = useSaveInfoDoc()
  const [docIds, setDocIds] = useState<string[]>(lesson?.doc_ids ?? [])
  const [find, setFind] = useState('')
  const [uploads, setUploads] = useState<{ file: File; title: string; categoryId: string; matches: DupMatch[]; allow: boolean }[]>([])
  const [busy, setBusy] = useState(false)
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
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setBusy(true)
          try {
            // a file uploaded here goes into the clinical-information library, so it exists once and is found in both places
            const blocked = uploads.find((u) => u.matches.length > 0 && !u.allow)
            if (blocked) {
              setError(`"${blocked.file.name}" דומה למסמך שכבר קיים — בחר "השתמש בקיים" או אשר העלאה בכל זאת`)
              setBusy(false)
              return
            }
            const newIds: string[] = []
            for (const u of uploads) {
              newIds.push(await saveDoc.mutateAsync({ title: u.title.trim() || u.file.name, description: '', categoryId: u.categoryId || null, procedureIds: [], tags: [], kind: 'file', url: '', file: u.file }))
            }
            save.mutate(
              { id: lesson?.id, topic_id: topicId, title, body, video_url: video, doc_ids: [...docIds, ...newIds], sort: lesson?.sort ?? nextSort, image, removeImage, existingImage: lesson?.image_path },
              { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'השמירה נכשלה'), onSettled: () => setBusy(false) },
            )
          } catch (er) {
            setError(er instanceof Error ? er.message : 'העלאת הקובץ נכשלה')
            setBusy(false)
          }
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
        <Field label="מסמכים מהמידע הקליני (PDF, מצגות…)">
          <div className="space-y-2">
            {(docIds.length > 0 || uploads.length > 0) && (
              <ul className="space-y-1">
                {docIds.map((id) => {
                  const d = (infoDocs.data ?? []).find((x) => x.id === id)
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-sm">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <FileText size={14} className="text-red-500" /> {d?.title ?? 'מסמך שנמחק'}
                      </span>
                      <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setDocIds((x) => x.filter((v) => v !== id))}>
                        הסר
                      </button>
                    </li>
                  )
                })}
                {uploads.map((u, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/40 px-2 py-1 text-sm">
                    <Upload size={14} className="text-brand-600" />
                    <input className="input !w-44 !py-0.5 text-xs" dir="auto" value={u.title} onChange={(e) => setUploads((x) => x.map((v, k) => (k === i ? { ...v, title: e.target.value } : v)))} aria-label="שם המסמך" />
                    <select className="input !w-auto !py-0.5 text-xs" value={u.categoryId} onChange={(e) => setUploads((x) => x.map((v, k) => (k === i ? { ...v, categoryId: e.target.value } : v)))} aria-label="קטגוריה במידע הקליני">
                      <option value="">קטגוריה במידע קליני…</option>
                      {(categories.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setUploads((x) => x.filter((_, k) => k !== i))}>
                      הסר
                    </button>
                    {u.matches.length > 0 && (
                      <div className="basis-full space-y-1">
                        <DuplicateWarning
                          matches={u.matches}
                          onUse={(d) => {
                            setDocIds((x) => (x.includes(d.id) ? x : [...x, d.id]))
                            setUploads((x) => x.filter((_, k) => k !== i))
                          }}
                        />
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={u.allow} onChange={(e) => setUploads((x) => x.map((v, k) => (k === i ? { ...v, allow: e.target.checked } : v)))} />
                          בדקתי — להעלות בכל זאת
                        </label>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <input className="input" type="search" dir="auto" placeholder="חיפוש מסמך קיים במידע הקליני…" value={find} onChange={(e) => setFind(e.target.value)} />
            {find.trim() && (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {(infoDocs.data ?? [])
                  .filter((d) => !docIds.includes(d.id) && (d.title + ' ' + d.file_name).toLowerCase().includes(find.trim().toLowerCase()))
                  .slice(0, 8)
                  .map((d) => (
                    <li key={d.id}>
                      <button type="button" className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-right text-sm hover:bg-slate-100" onClick={() => { setDocIds((x) => [...x, d.id]); setFind('') }}>
                        <Plus size={13} className="text-brand-600" /> {d.title}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <label className="btn-secondary inline-flex cursor-pointer text-xs">
              <Upload size={13} /> העלאת קובץ חדש (יישמר גם במידע הקליני)
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  // is the same / a similar file already in the library (the learning module shares it)?
                  const matches = findSimilarDocs({ names: [f.name], size: f.size, hash: await fileHash(f) }, infoDocs.data ?? [])
                  setUploads((x) => [...x, { file: f, title: f.name.replace(/\.[^.]+$/, ''), categoryId: '', matches, allow: false }])
                }}
              />
            </label>
          </div>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">שיעור שנכתב על ידי עורך תוכן מתפרסם רק אחרי שמנהל מאשר אותו.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" disabled={!title.trim() || save.isPending || busy}>
            {save.isPending || busy ? 'שומר…' : 'שמור'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** short lessons with text, a picture and a video — read before the questions of the topic */
export function LessonsPanel({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const lessons = useLessons(topicId)
  const canEdit = useCanEditLearning()
  const del = useDeleteLesson()
  const infoDocs = useInfoDocuments()
  const allCards = useLearnCards(topicId)
  const delCard = useDeleteCard()
  const [docError, setDocError] = useState('')
  const [reader, setReader] = useState<{ doc: InfoDocument; lessonId: string } | null>(null)
  const [gen, setGen] = useState<{ doc: InfoDocument; lessonId: string; text: string } | null>(null)
  const [cardModal, setCardModal] = useState<{ card: LearnCard | null; lessonId: string } | null>(null)
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
                    {l.doc_ids.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-400">מסמכים</p>
                        <div className="flex flex-wrap gap-2">
                          {l.doc_ids.map((id) => {
                            const d = (infoDocs.data ?? []).find((x) => x.id === id)
                            return d ? (
                              <span key={id} className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                                <button className="flex items-center gap-1.5 bg-white px-2.5 py-1 text-sm hover:bg-slate-50" onClick={() => setReader({ doc: d, lessonId: l.id })}>
                                  <BookOpenText size={14} className="text-brand-600" /> קרא: {d.title}
                                </button>
                                <button
                                  className="border-r border-slate-200 bg-slate-50 px-2 text-xs text-slate-500 hover:bg-slate-100"
                                  title="פתח את הקובץ המקורי"
                                  onClick={async () => setDocError((await openInfoDocument(d)) ?? '')}
                                >
                                  <FileText size={13} />
                                </button>
                              </span>
                            ) : null
                          })}
                        </div>
                        {docError && <p className="text-xs text-red-600">{docError}</p>}
                      </div>
                    )}
                    {(() => {
                      const mine = (allCards.data ?? []).filter((c) => c.lesson_id === l.id)
                      const docsOfLesson = l.doc_ids.map((id) => (infoDocs.data ?? []).find((x) => x.id === id)).filter((x): x is InfoDocument => !!x)
                      return (
                        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-700">שאלות על השיעור ({mine.filter((c) => c.approved).length})</p>
                            <span className="flex flex-wrap gap-2">
                              {mine.some((c) => c.approved) && (
                                <Link to={`/learn/${topicId}?lesson=${l.id}&tab=quiz`} className="btn-primary !py-1 text-xs">
                                  תרגל את שאלות השיעור
                                </Link>
                              )}
                              {canEdit && (
                                <>
                                  <button className="btn-secondary !py-1 text-xs" onClick={() => setCardModal({ card: null, lessonId: l.id })}>
                                    <Plus size={13} /> שאלה
                                  </button>
                                  {docsOfLesson.length > 0 && (
                                    <button className="btn-secondary !py-1 text-xs" onClick={() => setReader({ doc: docsOfLesson[0], lessonId: l.id })} title="פותח את המסמך וממנו אפשר ליצור שאלות">
                                      <Sparkles size={13} /> צור שאלות מהמסמך
                                    </button>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                          {mine.length === 0 ? (
                            <p className="text-xs text-slate-400">עדיין אין שאלות על השיעור הזה.</p>
                          ) : (
                            <ul className="space-y-1">
                              {mine.map((c) => (
                                <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-sm">
                                  <span dir="auto" className="min-w-0 flex-1 text-slate-700">
                                    {c.question}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1">
                                    <ApprovalTag approved={c.approved} table="learn_cards" id={c.id} topicId={topicId} label={c.question} />
                                    {canEdit && (
                                      <>
                                        <button className="btn-ghost !px-1" aria-label="עריכה" onClick={() => setCardModal({ card: c, lessonId: l.id })}>
                                          <Pencil size={12} />
                                        </button>
                                        <ConfirmButton className="btn-ghost !px-1 text-red-500" message="למחוק את השאלה?" onConfirm={() => delCard.mutate(c.id)}>
                                          <Trash2 size={12} />
                                        </ConfirmButton>
                                      </>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })()}
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
      {reader && (
        <DocReader
          doc={reader.doc}
          onClose={() => setReader(null)}
          onGenerate={canEdit ? (text) => { setGen({ doc: reader.doc, lessonId: reader.lessonId, text }); setReader(null) } : undefined}
        />
      )}
      {gen && <GenerateQuestions topicId={topicId} topicTitle={topicTitle} lessonId={gen.lessonId} docTitle={gen.doc.title} text={gen.text} onClose={() => setGen(null)} />}
      {cardModal && <LearnCardModal topicId={topicId} card={cardModal.card} lessons={list} defaultLessonId={cardModal.lessonId} onClose={() => setCardModal(null)} />}
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
