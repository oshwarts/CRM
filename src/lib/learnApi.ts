import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { supabase } from './supabase'
import { actingUserId } from './actingAs'
import { INFO_BUCKET } from './api'
import { useAuth } from '../context/AuthProvider'
import type { LearnAttempt, LearnCard, LearnCase, LearnDaily, LearnLesson, LearnProgress, LearnSequence, LearnTopic, LearnTrack, LearnTrackItem } from './types'
import { POINTS } from './learnGame'
import type { ParsedCard } from './learnParse'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** managers, and agents a manager marked as content editors, can add and change learning content */
export function useCanEditLearning() {
  const { isAdmin, profile } = useAuth()
  return isAdmin || profile?.is_content_editor === true
}

/* ---------------- images ---------------- */

export async function uploadLearnImage(file: File): Promise<string> {
  const ext = (file.name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? '').toLowerCase()
  const path = `learn/${crypto.randomUUID()}${ext}`
  const up = await supabase.storage.from(INFO_BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (up.error) throw up.error
  return path
}

/** a short-lived link to a stored image (kept for most of its life, so scrolling does not request it again) */
export function useImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['learn-image', path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    gcTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(INFO_BUCKET).createSignedUrl(path!, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

/* ---------------- topics, cards ---------------- */

export type TopicWithCount = LearnTopic & { cards: number }

export function useLearnTopics() {
  return useQuery({
    queryKey: ['learn-topics'],
    queryFn: async () => {
      const rows = unwrap<(LearnTopic & { learn_cards: { count: number }[] })[]>(
        await supabase.from('learn_topics').select('*, learn_cards(count)').order('sort').order('created_at'),
      )
      return rows.map(({ learn_cards, ...t }) => ({ ...t, cards: learn_cards[0]?.count ?? 0 }) as TopicWithCount)
    },
  })
}

export function useLearnCards(topicId: string | undefined) {
  return useQuery({
    queryKey: ['learn-cards', topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const all: LearnCard[] = []
      // the API returns 1000 rows at most per request
      for (let from = 0; ; from += 1000) {
        const page = unwrap<LearnCard[]>(await supabase.from('learn_cards').select('*').eq('topic_id', topicId!).order('sort').order('created_at').range(from, from + 999))
        all.push(...page)
        if (page.length < 1000) break
      }
      return all
    },
  })
}

/** one user's progress on every card (the user's own; a manager passes another agent's id) */
export function useLearnProgress(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['learn-progress', userId],
    enabled: !!userId,
    queryFn: async () => {
      const all: LearnProgress[] = []
      for (let from = 0; ; from += 1000) {
        const page = unwrap<LearnProgress[]>(await supabase.from('learn_progress').select('*').eq('user_id', userId!).range(from, from + 999))
        all.push(...page)
        if (page.length < 1000) break
      }
      return all
    },
  })
}

export function useLearnAttempts(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['learn-attempts', userId],
    enabled: !!userId,
    queryFn: async () => unwrap<LearnAttempt[]>(await supabase.from('learn_attempts').select('*').eq('user_id', userId!).order('taken_at', { ascending: false }).limit(500)),
  })
}

/** the best quiz result of each topic, in percent */
export function bestPercent(attempts: LearnAttempt[]): Map<string, number> {
  const best = new Map<string, number>()
  for (const a of attempts) {
    if (!a.total) continue
    const pct = Math.round((a.score / a.total) * 100)
    if (pct > (best.get(a.topic_id) ?? -1)) best.set(a.topic_id, pct)
  }
  return best
}

/* ---------------- spaced repetition ---------------- */

/** days until a card comes back, by box (box 0 = just missed → today) */
const INTERVALS = [0, 1, 3, 7, 14, 30]
export const nextBox = (box: number, correct: boolean) => (correct ? Math.min(box + 1, INTERVALS.length - 1) : 0)
export const dueDate = (box: number) => format(addDays(new Date(), INTERVALS[box]), 'yyyy-MM-dd')

/** records one answer: a right answer moves the card up a box (it returns later), a wrong one sends it back to box 0 */
export function useRecordAnswer() {
  const qc = useQueryClient()
  return useMutation({
    meta: { silent: true },
    mutationFn: async (a: { card: LearnCard; correct: boolean; prev: LearnProgress | undefined }) => {
      const user_id = await actingUserId()
      if (!user_id) throw new Error('לא מחובר')
      const box = nextBox(a.prev?.box ?? 0, a.correct)
      const row = {
        user_id,
        card_id: a.card.id,
        topic_id: a.card.topic_id,
        known: a.correct,
        box,
        due_on: dueDate(box),
        correct_count: (a.prev?.correct_count ?? 0) + (a.correct ? 1 : 0),
        wrong_count: (a.prev?.wrong_count ?? 0) + (a.correct ? 0 : 1),
        last_seen: new Date().toISOString(),
      }
      unwrap(await supabase.from('learn_progress').upsert(row, { onConflict: 'user_id,card_id' }))
      // the day's points (streak, goal and badges are built from them); a failure here must not lose the answer
      await supabase.rpc('learn_add_points', { p_points: a.correct ? POINTS.correct : POINTS.tried, p_answers: 1, p_correct: a.correct ? 1 : 0 })
      return row
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn-progress'] })
      qc.invalidateQueries({ queryKey: ['learn-daily'] })
    },
  })
}

/** the cards that are due for a repeat today (all topics) */
export function useDueCards(userId: string | null | undefined, progress: LearnProgress[]) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const ids = progress.filter((p) => p.due_on <= today && (p.wrong_count > 0 || p.correct_count > 0)).map((p) => p.card_id)
  return useQuery({
    queryKey: ['learn-due', userId, ids.length, ids[0] ?? ''],
    enabled: !!userId && ids.length > 0,
    queryFn: async () => {
      const out: LearnCard[] = []
      for (let i = 0; i < ids.length; i += 100) {
        out.push(...unwrap<LearnCard[]>(await supabase.from('learn_cards').select('*').in('id', ids.slice(i, i + 100))))
      }
      return out
    },
  })
}

export function useSaveAttempt() {
  const qc = useQueryClient()
  return useMutation({
    meta: { silent: true },
    // the picked answers go to the server, which grades them against the cards and writes the attempt itself
    mutationFn: async (a: { topic_id: string; picks: { card_id: string; answer: string | null }[] }) => {
      const { data, error: gradeError } = await supabase.rpc('learn_submit_attempt', { p_topic: a.topic_id, p_picks: a.picks })
      if (gradeError) throw gradeError
      const graded = (data as { o_score: number; o_total: number }[])[0]
      // passing a quiz can complete the training stage linked to the topic
      const { error } = await supabase.rpc('sync_learning_stages')
      if (error) throw error
      const bonus = POINTS.quizDone + (graded && graded.o_total > 0 && graded.o_score === graded.o_total ? POINTS.perfect : 0)
      await supabase.rpc('learn_add_points', { p_points: bonus, p_answers: 0, p_correct: 0 })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn-daily'] })
      qc.invalidateQueries({ queryKey: ['learn-attempts'] })
      qc.invalidateQueries({ queryKey: ['agent-training'] })
    },
  })
}

/** forgets the user's progress on a topic */
export function useResetProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (topicId: string) => {
      const user_id = await actingUserId()
      if (!user_id) throw new Error('לא מחובר')
      unwrap(await supabase.from('learn_progress').delete().eq('user_id', user_id).eq('topic_id', topicId))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-progress'] }),
  })
}

/* ---------------- content ---------------- */

const invalidateContent = (qc: ReturnType<typeof useQueryClient>) => {
  for (const k of ['learn-cards', 'learn-topics', 'learn-lessons', 'learn-cases', 'learn-pending']) qc.invalidateQueries({ queryKey: [k] })
}

export function useSaveTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: { id?: string; title: string; description: string; sort?: number }) => {
      const row = { title: t.title.trim(), description: t.description.trim(), ...(t.sort !== undefined ? { sort: t.sort } : {}) }
      if (t.id) unwrap(await supabase.from('learn_topics').update(row).eq('id', t.id))
      else unwrap(await supabase.from('learn_topics').insert(row))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-topics'] }),
  })
}

export function useDeleteTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_topics').delete().eq('id', id)),
    onSuccess: () => invalidateContent(qc),
  })
}

export function useSaveCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: {
      id?: string
      topic_id: string
      question: string
      answer: string
      wrong_options?: string[]
      explanation?: string
      lesson_id?: string | null
      sort?: number
      image?: File | null
      removeImage?: boolean
      existingImage?: string | null
    }) => {
      let image_path = c.removeImage ? null : (c.existingImage ?? null)
      if (c.image) image_path = await uploadLearnImage(c.image)
      const row = {
        topic_id: c.topic_id,
        question: c.question.trim(),
        answer: c.answer.trim(),
        wrong_options: (c.wrong_options ?? []).map((w) => w.trim()).filter(Boolean),
        explanation: (c.explanation ?? '').trim(),
        lesson_id: c.lesson_id ?? null,
        image_path,
      }
      if (c.id) unwrap(await supabase.from('learn_cards').update(row).eq('id', c.id))
      else unwrap(await supabase.from('learn_cards').insert({ ...row, sort: c.sort ?? 0 }))
    },
    onSuccess: () => invalidateContent(qc),
  })
}

export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_cards').delete().eq('id', id)),
    onSuccess: () => invalidateContent(qc),
  })
}

/** adds many cards at the end of the topic; a question that already exists in it is skipped. Returns how many were added. */
export function useImportCards() {
  const qc = useQueryClient()
  return useMutation({
    // draft = saved as not approved, for a manager to review and approve
    mutationFn: async ({ topicId, cards, draft }: { topicId: string; cards: ParsedCard[]; draft?: boolean }) => {
      const existing = unwrap<{ question: string; sort: number }[]>(await supabase.from('learn_cards').select('question, sort').eq('topic_id', topicId).limit(5000))
      const have = new Set(existing.map((e) => e.question.trim().toLowerCase()))
      let sort = existing.reduce((m, e) => Math.max(m, e.sort), -1) + 1
      const fresh = cards
        .filter((c) => !have.has(c.question.trim().toLowerCase()))
        .map((c) => ({ topic_id: topicId, question: c.question, answer: c.answer, wrong_options: c.wrong ?? [], explanation: c.explanation ?? '', ...(draft ? { approved: false } : {}), sort: sort++ }))
      for (let i = 0; i < fresh.length; i += 200) unwrap(await supabase.from('learn_cards').insert(fresh.slice(i, i + 200)))
      return { added: fresh.length, skipped: cards.length - fresh.length }
    },
    onSuccess: () => invalidateContent(qc),
  })
}

/* ---------------- lessons ---------------- */

export function useLessons(topicId: string | undefined) {
  return useQuery({
    queryKey: ['learn-lessons', topicId],
    enabled: !!topicId,
    queryFn: async () => unwrap<LearnLesson[]>(await supabase.from('learn_lessons').select('*').eq('topic_id', topicId!).order('sort').order('created_at')),
  })
}

export function useSaveLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (l: { id?: string; topic_id: string; title: string; body: string; video_url: string; doc_ids: string[]; sort: number; image?: File | null; removeImage?: boolean; existingImage?: string | null }) => {
      let image_path = l.removeImage ? null : (l.existingImage ?? null)
      if (l.image) image_path = await uploadLearnImage(l.image)
      const row = { topic_id: l.topic_id, title: l.title.trim(), body: l.body.trim(), video_url: l.video_url.trim(), doc_ids: l.doc_ids, image_path }
      if (l.id) unwrap(await supabase.from('learn_lessons').update(row).eq('id', l.id))
      else unwrap(await supabase.from('learn_lessons').insert({ ...row, sort: l.sort }))
    },
    onSuccess: () => invalidateContent(qc),
  })
}

export function useDeleteLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_lessons').delete().eq('id', id)),
    onSuccess: () => invalidateContent(qc),
  })
}

/* ---------------- clinical cases ---------------- */

export function useCases(topicId: string | undefined) {
  return useQuery({
    queryKey: ['learn-cases', topicId],
    enabled: !!topicId,
    queryFn: async () => unwrap<LearnCase[]>(await supabase.from('learn_cases').select('*').eq('topic_id', topicId!).order('sort').order('created_at')),
  })
}

export function useSaveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: {
      id?: string
      topic_id: string
      title: string
      scenario: string
      question: string
      options: string[]
      correct_index: number
      explanation: string
      sort: number
      image?: File | null
      removeImage?: boolean
      existingImage?: string | null
    }) => {
      let image_path = c.removeImage ? null : (c.existingImage ?? null)
      if (c.image) image_path = await uploadLearnImage(c.image)
      const options = c.options.map((o) => o.trim()).filter(Boolean)
      const row = {
        topic_id: c.topic_id,
        title: c.title.trim(),
        scenario: c.scenario.trim(),
        question: c.question.trim(),
        options,
        correct_index: Math.min(Math.max(0, c.correct_index), Math.max(0, options.length - 1)),
        explanation: c.explanation.trim(),
        image_path,
      }
      if (c.id) unwrap(await supabase.from('learn_cases').update(row).eq('id', c.id))
      else unwrap(await supabase.from('learn_cases').insert({ ...row, sort: c.sort }))
    },
    onSuccess: () => invalidateContent(qc),
  })
}

export function useDeleteCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_cases').delete().eq('id', id)),
    onSuccess: () => invalidateContent(qc),
  })
}

/* ---------------- approval (managers) ---------------- */

export type PendingItem = { table: 'learn_cards' | 'learn_lessons' | 'learn_cases' | 'learn_sequences'; id: string; topic_id: string; label: string }

/** everything an editor wrote that waits for a manager's approval */
export function usePendingApprovals(enabled: boolean) {
  return useQuery({
    queryKey: ['learn-pending'],
    enabled,
    queryFn: async () => {
      const [cards, lessons, cases, sequences] = await Promise.all([
        supabase.from('learn_cards').select('id, topic_id, question').eq('approved', false).limit(500),
        supabase.from('learn_lessons').select('id, topic_id, title').eq('approved', false).limit(200),
        supabase.from('learn_cases').select('id, topic_id, title').eq('approved', false).limit(200),
        supabase.from('learn_sequences').select('id, topic_id, title').eq('approved', false).limit(200),
      ])
      const out: PendingItem[] = []
      for (const c of unwrap<{ id: string; topic_id: string; question: string }[]>(cards)) out.push({ table: 'learn_cards', id: c.id, topic_id: c.topic_id, label: c.question })
      for (const l of unwrap<{ id: string; topic_id: string; title: string }[]>(lessons)) out.push({ table: 'learn_lessons', id: l.id, topic_id: l.topic_id, label: l.title })
      for (const c of unwrap<{ id: string; topic_id: string; title: string }[]>(cases)) out.push({ table: 'learn_cases', id: c.id, topic_id: c.topic_id, label: c.title })
      for (const c of unwrap<{ id: string; topic_id: string; title: string }[]>(sequences)) out.push({ table: 'learn_sequences', id: c.id, topic_id: c.topic_id, label: c.title })
      return out
    },
  })
}

export function useApprove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: PendingItem[]) => {
      for (const t of ['learn_cards', 'learn_lessons', 'learn_cases', 'learn_sequences'] as const) {
        const ids = items.filter((i) => i.table === t).map((i) => i.id)
        for (let k = 0; k < ids.length; k += 100) unwrap(await supabase.from(t).update({ approved: true }).in('id', ids.slice(k, k + 100)))
      }
    },
    onSuccess: () => invalidateContent(qc),
  })
}

/* ---------------- tracks ---------------- */

export type TrackWithItems = LearnTrack & { items: LearnTrackItem[] }

export function useTracks() {
  return useQuery({
    queryKey: ['learn-tracks'],
    queryFn: async () => {
      const rows = unwrap<(LearnTrack & { items: LearnTrackItem[] })[]>(
        await supabase.from('learn_tracks').select('*, items:learn_track_items(*)').order('sort').order('created_at'),
      )
      return rows.map((t) => ({ ...t, items: [...t.items].sort((a, b) => a.sort - b.sort) })) as TrackWithItems[]
    },
  })
}

const invalidateTracks = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['learn-tracks'] })

export function useSaveTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: { id?: string; title: string; description: string; audience: string; sort?: number }) => {
      const row = { title: t.title.trim(), description: t.description.trim(), audience: t.audience, ...(t.sort !== undefined ? { sort: t.sort } : {}) }
      if (t.id) unwrap(await supabase.from('learn_tracks').update(row).eq('id', t.id))
      else unwrap(await supabase.from('learn_tracks').insert(row))
    },
    onSuccess: () => invalidateTracks(qc),
  })
}

export function useDeleteTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_tracks').delete().eq('id', id)),
    onSuccess: () => invalidateTracks(qc),
  })
}

export function useSaveTrackItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id?: string; track_id: string; topic_id: string; sort: number; pass_pct: number; stage_id: string | null }) => {
      const row = { track_id: i.track_id, topic_id: i.topic_id, sort: i.sort, pass_pct: Math.min(100, Math.max(1, Math.round(i.pass_pct) || 80)), stage_id: i.stage_id }
      if (i.id) unwrap(await supabase.from('learn_track_items').update(row).eq('id', i.id))
      else unwrap(await supabase.from('learn_track_items').insert(row))
    },
    onSuccess: () => invalidateTracks(qc),
  })
}

export function useDeleteTrackItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_track_items').delete().eq('id', id)),
    onSuccess: () => invalidateTracks(qc),
  })
}

/** swaps the order of two steps of a track */
export function useSwapTrackItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ a, b }: { a: LearnTrackItem; b: LearnTrackItem }) => {
      const sa = a.sort === b.sort ? b.sort + 1 : b.sort
      unwrap(await supabase.from('learn_track_items').update({ sort: sa }).eq('id', a.id))
      unwrap(await supabase.from('learn_track_items').update({ sort: a.sort }).eq('id', b.id))
    },
    onSuccess: () => invalidateTracks(qc),
  })
}

/** questions written by the AI from a document: saved as DRAFTS (not approved) until a manager approves them */
export function useAddGeneratedCards() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { topicId: string; lessonId: string | null; items: { question: string; correct: string; wrong: string[]; explanation: string }[] }) => {
      const existing = unwrap<{ question: string; sort: number }[]>(await supabase.from('learn_cards').select('question, sort').eq('topic_id', a.topicId).limit(5000))
      const have = new Set(existing.map((e) => e.question.trim().toLowerCase()))
      let sort = existing.reduce((m, e) => Math.max(m, e.sort), -1) + 1
      const rows = a.items
        .filter((i) => i.question.trim() && i.correct.trim() && !have.has(i.question.trim().toLowerCase()))
        .map((i) => ({
          topic_id: a.topicId,
          lesson_id: a.lessonId,
          question: i.question.trim(),
          answer: i.correct.trim(),
          wrong_options: i.wrong.map((w) => w.trim()).filter(Boolean),
          explanation: i.explanation.trim(),
          approved: false,
          sort: sort++,
        }))
      if (rows.length) unwrap(await supabase.from('learn_cards').insert(rows))
      return { added: rows.length, skipped: a.items.length - rows.length }
    },
    onSuccess: () => invalidateContent(qc),
  })
}

/* ---------------- daily activity (streak, points) ---------------- */

export function useLearnDaily(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['learn-daily', userId],
    enabled: !!userId,
    queryFn: async () => unwrap<LearnDaily[]>(await supabase.from('learn_daily').select('*').eq('user_id', userId!).order('day', { ascending: false }).limit(400)),
  })
}

/** points for an activity that is not a stored card answer (a sequence, a matching round, a case) */
export function useAddPoints() {
  const qc = useQueryClient()
  return useMutation({
    meta: { silent: true },
    mutationFn: async (a: { points: number; answers: number; correct: number }) => {
      await supabase.rpc('learn_add_points', { p_points: a.points, p_answers: a.answers, p_correct: a.correct })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-daily'] }),
  })
}

/* ---------------- sequences ("put the steps in order") ---------------- */

export function useSequences(topicId: string | undefined) {
  return useQuery({
    queryKey: ['learn-sequences', topicId],
    enabled: !!topicId,
    queryFn: async () => unwrap<LearnSequence[]>(await supabase.from('learn_sequences').select('*').eq('topic_id', topicId!).order('sort').order('created_at')),
  })
}

export function useSaveSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (q: { id?: string; topic_id: string; title: string; steps: string[]; sort: number }) => {
      const row = { topic_id: q.topic_id, title: q.title.trim(), steps: q.steps.map((x) => x.trim()).filter(Boolean) }
      if (q.id) unwrap(await supabase.from('learn_sequences').update(row).eq('id', q.id))
      else unwrap(await supabase.from('learn_sequences').insert({ ...row, sort: q.sort }))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn-sequences'] })
      qc.invalidateQueries({ queryKey: ['learn-pending'] })
    },
  })
}

export function useDeleteSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_sequences').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-sequences'] }),
  })
}
