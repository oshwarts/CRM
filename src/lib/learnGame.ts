import { addDays, format } from 'date-fns'
import type { LearnDaily } from './types'

/** gentle motivation: a daily goal, points, a streak of days and a few badges — no ranking between agents */
export const POINTS = { correct: 2, tried: 1, quizDone: 10, perfect: 10, round: 5 }
export const DAILY_GOAL = 10

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** consecutive days with at least one answer, counted back from today (or from yesterday while today is still empty) */
export function streakOf(days: LearnDaily[], today: string): { current: number; best: number } {
  const active = new Set(days.filter((d) => d.answers > 0 || d.points > 0).map((d) => d.day))
  const at = (s: string) => new Date(`${s}T12:00:00`)
  let cur = 0
  let cursor = active.has(today) ? at(today) : addDays(at(today), -1)
  while (active.has(iso(cursor))) {
    cur++
    cursor = addDays(cursor, -1)
  }
  // the longest run ever
  const sorted = [...active].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && iso(addDays(at(prev), 1)) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return { current: cur, best }
}

export type Badge = { id: string; title: string; hint: string; icon: string; earned: boolean }

export function badgesOf(input: { days: LearnDaily[]; streakBest: number; perfectQuizzes: number; topicsMastered: number; answers: number }): Badge[] {
  const points = input.days.reduce((n, d) => n + d.points, 0)
  const correct = input.days.reduce((n, d) => n + d.correct, 0)
  return [
    { id: 'first', title: 'התחלה', hint: 'ענית על השאלה הראשונה', icon: '🌱', earned: input.answers >= 1 },
    { id: 'streak3', title: 'שלושה ימים ברצף', hint: 'למדת 3 ימים ברצף', icon: '🔥', earned: input.streakBest >= 3 },
    { id: 'streak7', title: 'שבוע ברצף', hint: 'למדת 7 ימים ברצף', icon: '🏅', earned: input.streakBest >= 7 },
    { id: 'streak30', title: 'חודש ברצף', hint: 'למדת 30 ימים ברצף', icon: '🏆', earned: input.streakBest >= 30 },
    { id: 'points100', title: '100 נקודות', hint: 'צברת 100 נקודות', icon: '⭐', earned: points >= 100 },
    { id: 'points500', title: '500 נקודות', hint: 'צברת 500 נקודות', icon: '🌟', earned: points >= 500 },
    { id: 'correct100', title: '100 תשובות נכונות', hint: 'ענית נכון 100 פעמים', icon: '🎯', earned: correct >= 100 },
    { id: 'perfect', title: 'מבחן מושלם', hint: 'קיבלת 100% במבחן', icon: '💯', earned: input.perfectQuizzes >= 1 },
    { id: 'master', title: 'שליטה בנושא', hint: 'ידעת 90% משאלות של נושא (לפחות 10 שאלות)', icon: '🎓', earned: input.topicsMastered >= 1 },
  ]
}
