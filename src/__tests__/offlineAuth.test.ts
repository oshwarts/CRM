import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { cacheProfile, clearCachedProfiles, isNetworkFailure, pickSession, readCachedProfile, readStoredSession } from '../lib/offlineAuth'

class Mem {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } } as unknown as Session

describe('the saved session', () => {
  it('is read from the key the supabase client uses, and only when it has a refresh token and a user', () => {
    const s = new Mem()
    s.setItem('other', '{}')
    expect(readStoredSession(s)).toBeNull()
    s.setItem('sb-abc-auth-token', JSON.stringify({ access_token: 'a', user: { id: 'u1' } }))
    expect(readStoredSession(s)).toBeNull() // no refresh token
    s.setItem('sb-abc-auth-token', JSON.stringify(session))
    expect(readStoredSession(s)?.user.id).toBe('u1')
    s.setItem('sb-abc-auth-token', '{broken')
    expect(readStoredSession(s)).toBeNull()
  })
})

describe('which session the app starts with', () => {
  it('uses the client session when it has one', () => {
    expect(pickSession(session, null, null, true)).toBe(session)
  })
  it('uses the saved session when the device is offline, or the server could not be reached', () => {
    expect(pickSession(null, null, session, false)).toBe(session)
    expect(pickSession(null, { name: 'AuthRetryableFetchError', message: 'x' }, session, true)).toBe(session)
    expect(pickSession(null, { message: 'TypeError: Failed to fetch' }, session, true)).toBe(session)
    expect(pickSession(null, { message: 'timeout' }, session, true)).toBe(session)
  })
  it('does not use it when the server answered "no" (a revoked or missing session ends in the sign-in page)', () => {
    expect(pickSession(null, null, session, true)).toBeNull()
    expect(pickSession(null, { name: 'AuthApiError', message: 'Invalid Refresh Token' }, session, true)).toBeNull()
    expect(pickSession(null, null, null, false)).toBeNull()
    expect(isNetworkFailure(undefined)).toBe(false)
  })
})

describe('the saved profile', () => {
  it('is kept per user, read back, and removed on sign-out', () => {
    const s = new Mem()
    cacheProfile(s, 'u1', { id: 'u1', role: 'admin' })
    cacheProfile(s, 'u2', { id: 'u2', role: 'agent' })
    s.setItem('keep', '1')
    expect(readCachedProfile<{ role: string }>(s, 'u1')?.role).toBe('admin')
    expect(readCachedProfile(s, 'nobody')).toBeNull()
    clearCachedProfiles(s)
    expect(readCachedProfile(s, 'u1')).toBeNull()
    expect(s.getItem('keep')).toBe('1')
  })
})
