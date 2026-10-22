import { describe, expect, it } from 'vitest'
import { waitsBehindQueued, type Op } from '../lib/outbox'

const op = (o: Partial<Op>): Op => ({ id: 'x', kind: 'meeting.save', userId: 'u', createdAt: 0, label: '', recordIds: [], payload: null, state: 'pending', ...o })

describe('a change waits behind an unsent change of the same record', () => {
  it('an edit of a meeting whose creation is still queued waits (it would find nothing to edit)', () => {
    expect(waitsBehindQueued(['m1'], [op({ recordIds: ['m1'] })])).toBe(true)
  })
  it('the same for a task and its steps, and for two edits of one scan (the older value must not arrive last)', () => {
    expect(waitsBehindQueued(['s1'], [op({ kind: 'subtask.add', recordIds: ['t1', 's1'] })])).toBe(true)
    expect(waitsBehindQueued(['t1'], [op({ kind: 'subtask.add', recordIds: ['t1', 's1'] })])).toBe(true)
    expect(waitsBehindQueued(['scan1'], [op({ kind: 'scan.patch', recordIds: ['scan1'] })])).toBe(true)
  })
  it('a failed earlier change of the record also holds the next one back', () => {
    expect(waitsBehindQueued(['m1'], [op({ recordIds: ['m1'], state: 'failed' })])).toBe(true)
  })
  it('other records, and a change that only waits for a decision (conflict), do not block', () => {
    expect(waitsBehindQueued(['m2'], [op({ recordIds: ['m1'] })])).toBe(false)
    expect(waitsBehindQueued(['m1'], [op({ recordIds: ['m1'], state: 'conflict' })])).toBe(false)
    expect(waitsBehindQueued(['m1'], [])).toBe(false)
  })
})
