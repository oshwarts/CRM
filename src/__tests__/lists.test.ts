import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contactState } from '../lib/cadence'
import { buildDoctorRows } from '../lib/doctorStats'
import { buildHospitalRows } from '../lib/hospitalStats'
import { scopeState } from '../lib/training'

const NOW = new Date('2026-10-18T10:00:00')
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const meeting = (doctorId: string, n: number, status = 'done', hospitalId: string | null = null) =>
  ({ id: `m${doctorId}${n}`, status, meeting_date: day(n), hospital_id: hospitalId, meeting_doctors: [{ doctor: { id: doctorId } }] }) as never

describe('contactState (is it time to meet the doctor again?)', () => {
  const doc = (cadence: number | null) => ({ id: 'd', contact_cadence_days: cadence, created_at: `${day(-200)}T00:00:00Z` })
  it('is overdue when the last meeting is older than the cadence', () => {
    const s = contactState(doc(30), [meeting('d', -45)])
    expect(s.status).toBe('due')
    expect(s.daysToDue).toBe(-15)
  })
  it('a meeting already booked covers the cadence', () => {
    expect(contactState(doc(30), [meeting('d', -45), meeting('d', 5, 'scheduled')]).status).toBe('ok')
  })
  it('a past meeting that was never closed is no proof of contact', () => {
    expect(contactState(doc(30), [meeting('d', -3, 'scheduled')]).lastDate).toBeNull()
  })
  it('without a cadence there is nothing to be late for', () => {
    expect(contactState(doc(null), []).status).toBe('none')
  })
})

describe('doctors list rows', () => {
  const doctor = (id: string, cadence: number | null) =>
    ({ id, name: id, title: '', position: '', phone: '050', email: '', status: 'client', pipeline_stage: '', next_step: '', next_step_date: null, contact_cadence_days: cadence, created_at: `${day(-200)}T00:00:00Z`, doctor_hospitals: [{ hospital_id: 'h', hospital: { name: 'ה' } }], doctor_companies: [], doctor_procedures: [{ procedure_id: 'p' }], doctor_robotic_systems: [] }) as never
  const rows = (meetings: never[], windowDays = 90) =>
    buildDoctorRows({ doctors: [doctor('a', 30), doctor('b', null)], meetings, scans: [], planned: [], intel: [], robotNames: new Map(), companyNames: new Map(), windowDays })
  it('needs contact: overdue by cadence, or no cadence and not met for 60 days', () => {
    const r = rows([meeting('a', -45)])
    expect(r.find((x) => x.d.id === 'a')?.need).toBe('due')
    expect(r.find((x) => x.d.id === 'b')?.need).toBe('stale')
  })
  it('a doctor met recently needs nothing', () => {
    const r = rows([meeting('a', -5), meeting('b', -5)])
    expect(r.every((x) => x.need === '')).toBe(true)
  })
  it('counts surgeries of the doctor in the chosen window only (scans and entered ones)', () => {
    const scan = (n: number) => ({ id: `s${n}`, status: 'planned', surgeon_id: 'a', surgery_date: day(n) }) as never
    const planned = { id: 'p', status: 'planned', doctor_id: 'a', surgery_date: day(-5), cases: 3 } as never
    const input = { doctors: [doctor('a', 30)], meetings: [], scans: [scan(-10), scan(-40), scan(-200)], planned: [planned], intel: [], robotNames: new Map(), companyNames: new Map() }
    expect(buildDoctorRows({ ...input, windowDays: 30 })[0].surgeries).toBe(4)
    expect(buildDoctorRows({ ...input, windowDays: 90 })[0].surgeries).toBe(5)
  })
})

describe('hospitals list rows', () => {
  const hospital = (over: Record<string, unknown> = {}) =>
    ({ id: 'h', name: 'ה', city: '', commercial_status: '', next_step: '', next_step_date: null, organization: null, hospital_agents: [], hospital_robotic_systems: [{ system: { name: 'Mako' } }], contacts: [], doctor_hospitals: [], case_volumes: [], ...over }) as never
  it('suggests "client" for a hospital with Mako until a status is saved', () => {
    const [r] = buildHospitalRows({ hospitals: [hospital()], meetings: [], scans: [], planned: [] })
    expect(r.status).toBe('client')
    expect(r.suggested).toBe(true)
    const [saved] = buildHospitalRows({ hospitals: [hospital({ commercial_status: 'potential' })], meetings: [], scans: [], planned: [] })
    expect(saved.status).toBe('potential')
    expect(saved.suggested).toBe(false)
  })
  it('warns: no visit, no agent, no contact, and a client without surgeries', () => {
    const [r] = buildHospitalRows({ hospitals: [hospital()], meetings: [meeting('d', -90, 'done', 'h')], scans: [], planned: [] })
    expect(r.warnings.map((w) => w.key).sort()).toEqual(['no-agent', 'no-contact', 'no-visit', 'quiet-client'])
  })
  it('a hospital closed as irrelevant has no warnings', () => {
    const [r] = buildHospitalRows({ hospitals: [hospital({ commercial_status: 'irrelevant' })], meetings: [], scans: [], planned: [] })
    expect(r.warnings).toEqual([])
  })
})

describe('training progress', () => {
  const stage = { id: 's1', name: 'JR101', procedure_id: null, required_count: 1, sort: 1, created_at: '' } as never
  it('a started training that did not move for 30 days is stuck', () => {
    const rows = [{ id: 'r', agent_id: 'a', stage_id: 's1', completed_on: day(-50), notes: '' }] as never
    const st = scopeState([stage, { ...(stage as object), id: 's2', sort: 2 } as never], rows, day(0))
    expect(st.doneCount).toBe(1)
    expect(st.stuck).toBe(true)
  })
  it('a finished scope is complete and never stuck', () => {
    const rows = [{ id: 'r', agent_id: 'a', stage_id: 's1', completed_on: day(-90), notes: '' }] as never
    const st = scopeState([stage], rows, day(0))
    expect(st.complete).toBe(true)
    expect(st.stuck).toBe(false)
  })
})
