import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { actingUserId } from './actingAs'
import type { LearnAttempt, LearnCard, LearnProgress, LearnTopic } from './types'
import type { ParsedCard } from './learnParse'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

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
    queryFn: async () => unwrap<LearnAttempt[]>(await supabase.from('learn_attempts').select('*').eq('user_id', userId!).order('taken_at', { ascending: false }).limit(200)),
  })
}

/** records one answer: the card is "known" after a right answer / a "I knew it", and the counters grow */
export function useRecordAnswer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { card: LearnCard; correct: boolean; prev: LearnProgress | undefined }) => {
      const user_id = await actingUserId()
      if (!user_id) throw new Error('לא מחובר')
      const row = {
        user_id,
        card_id: a.card.id,
        topic_id: a.card.topic_id,
        known: a.correct,
        correct_count: (a.prev?.correct_count ?? 0) + (a.correct ? 1 : 0),
        wrong_count: (a.prev?.wrong_count ?? 0) + (a.correct ? 0 : 1),
        last_seen: new Date().toISOString(),
      }
      unwrap(await supabase.from('learn_progress').upsert(row, { onConflict: 'user_id,card_id' }))
      return row
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-progress'] }),
  })
}

export function useSaveAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { topic_id: string; score: number; total: number }) => {
      const user_id = await actingUserId()
      if (!user_id) throw new Error('לא מחובר')
      unwrap(await supabase.from('learn_attempts').insert({ ...a, user_id }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-attempts'] }),
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

/* ---------------- content (managers) ---------------- */

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learn-topics'] }),
  })
}

export function useSaveCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: { id?: string; topic_id: string; question: string; answer: string; sort?: number }) => {
      const row = { topic_id: c.topic_id, question: c.question.trim(), answer: c.answer.trim() }
      if (c.id) unwrap(await supabase.from('learn_cards').update(row).eq('id', c.id))
      else unwrap(await supabase.from('learn_cards').insert({ ...row, sort: c.sort ?? 0 }))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn-cards'] })
      qc.invalidateQueries({ queryKey: ['learn-topics'] })
    },
  })
}

export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('learn_cards').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn-cards'] })
      qc.invalidateQueries({ queryKey: ['learn-topics'] })
    },
  })
}

/** adds many cards at the end of the topic; a question that already exists in it is skipped. Returns how many were added. */
export function useImportCards() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ topicId, cards }: { topicId: string; cards: ParsedCard[] }) => {
      const existing = unwrap<{ question: string; sort: number }[]>(await supabase.from('learn_cards').select('question, sort').eq('topic_id', topicId).limit(5000))
      const have = new Set(existing.map((e) => e.question.trim().toLowerCase()))
      let sort = existing.reduce((m, e) => Math.max(m, e.sort), -1) + 1
      const fresh = cards.filter((c) => !have.has(c.question.trim().toLowerCase())).map((c) => ({ topic_id: topicId, question: c.question, answer: c.answer, sort: sort++ }))
      for (let i = 0; i < fresh.length; i += 200) unwrap(await supabase.from('learn_cards').insert(fresh.slice(i, i + 200)))
      return { added: fresh.length, skipped: cards.length - fresh.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn-cards'] })
      qc.invalidateQueries({ queryKey: ['learn-topics'] })
    },
  })
}
