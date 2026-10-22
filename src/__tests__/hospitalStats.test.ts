import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHospitalRows, NO_VISIT_DAYS, suggestStatus } from '../lib/hospitalStats'

// "today" is a fixed local day, late in the evening: the logic must use the local day, not UTC
const TODAY = new Date(2026, 9, 22, 23, 30)
const day = (n: number) => {
  const x = new Date(2026, 9, 22 + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})
afterEach(() => vi.useRealTimers())

const hospital = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, name: id, city: '', commercial_status: '', hospital_agents: [], hospital_robotic_systems: [], contacts: [], doctor_hospitals: [], organization: null, ...o }) as never
const robot = (name: string) => ({ system: { id: name, name } })
const agent = (id: string) => ({ agent: { id, full_name: id } })
const meeting = (hospital_id: string, ago: number, status = 'done') => ({ hospital_id, meeting_date: day(-ago), status }) as never
const scan = (hospital_id: string, ago: number, status = 'done') => ({ hospital_id, surgery_date: day(-ago), status }) as never
const planned = (hospital_id: string, ago: number, cases: number | null, status = 'planned') => ({ hospital_id, surgery_date: day(-ago), cases, status }) as never

const build = (hospitals: unknown[], o: { meetings?: unknown[]; scans?: unknown[]; planned?: unknown[] } = {}) =>
  buildHospitalRows({ hospitals: hospitals as never, meetings: (o.meetings ?? []) as never, scans: (o.scans ?? []) as never, planned: (o.planned ?? []) as never })

describe('suggested commercial status', () => {
  it('MAKO means client, another robot means competitor, no robot means potential', () => {
    expect(suggestStatus(['Mako'])).toBe('client')
    expect(suggestStatus(['VELYS', 'MAKO SmartRobotics'])).toBe('client')
    expect(suggestStatus(['VELYS'])).toBe('competitor')
    expect(suggestStatus([])).toBe('potential')
  })
  it('a stored status wins and is not marked as a suggestion', () => {
    const [a, b] = build([hospital('a', { commercial_status: 'onboarding', hospital_robotic_systems: [robot('Mako')] }), hospital('b', { hospital_robotic_systems: [robot('VELYS')] })])
    expect([a.status, a.suggested]).toEqual(['onboarding', false])
    expect([b.status, b.suggested]).toEqual(['competitor', true])
  })
})

describe('last visit', () => {
  it('is the latest done / follow-up meeting up to today, counted in local days', () => {
    const [r] = build([hospital('a')], { meetings: [meeting('a', 20), meeting('a', 5, 'needs_followup'), meeting('a', 2, 'cancelled'), meeting('a', -3, 'done'), meeting('a', 1, 'scheduled')] })
    expect(r.lastMeeting).toBe(day(-5))
    expect(r.daysSince).toBe(5)
  })
  it('a meeting today is 0 days; no meeting is null', () => {
    const rows = build([hospital('a'), hospital('b')], { meetings: [meeting('a', 0)] })
    expect(rows[0].daysSince).toBe(0)
    expect(rows[1].daysSince).toBeNull()
  })
  it('ignores meetings without a date or a hospital', () => {
    const [r] = build([hospital('a')], { meetings: [{ hospital_id: 'a', meeting_date: null, status: 'done' }, { hospital_id: null, meeting_date: day(-1), status: 'done' }] })
    expect(r.lastMeeting).toBeNull()
  })
})

describe('no-visit warning', () => {
  const warns = (ago: number | null) => {
    const [r] = build([hospital('a', { hospital_agents: [agent('u')], contacts: [{ phone: '1' }] })], { meetings: ago === null ? [] : [meeting('a', ago)] })
    return r.warnings.find((w) => w.key === 'no-visit')
  }
  it(`appears after more than ${NO_VISIT_DAYS} days, not at exactly ${NO_VISIT_DAYS}`, () => {
    expect(warns(NO_VISIT_DAYS)).toBeUndefined()
    expect(warns(NO_VISIT_DAYS + 1)?.label).toBe('ללא ביקור 61 ימים')
  })
  it('appears when there never was a meeting', () => expect(warns(null)?.label).toBe('לא נערכה פגישה'))
})

describe('surgeries in the last 30 days and the next 30', () => {
  it('counts a scan exactly 30 days ago and today, not 31 days ago, not cancelled, not without a date', () => {
    const [r] = build([hospital('a')], { scans: [scan('a', 30), scan('a', 0), scan('a', 31), scan('a', 5, 'cancelled'), { hospital_id: 'a', surgery_date: null, status: 'planned' }] })
    expect(r.surgeries30).toBe(2)
  })
  it('counts planned entries by their number of cases (a missing number is 1) and skips cancelled ones', () => {
    const [r] = build([hospital('a')], { planned: [planned('a', 10, 3), planned('a', 3, null), planned('a', 2, 4, 'cancelled'), planned('a', 45, 9)] })
    expect(r.surgeries30).toBe(4)
  })
  it('the next 30 days: tomorrow..+30 days, not today, not +31', () => {
    const [r] = build([hospital('a')], { scans: [scan('a', -1, 'planned'), scan('a', -30, 'planned'), scan('a', -31, 'planned')], planned: [planned('a', -2, 2), planned('a', 0, 7)] })
    expect(r.upcoming30).toBe(4)
    expect(r.surgeries30).toBe(7)
  })
  it('is per hospital, and a surgery of no hospital is ignored', () => {
    const rows = build([hospital('a'), hospital('b')], { scans: [scan('a', 1), { hospital_id: null, surgery_date: day(-1), status: 'done' }] })
    expect([rows[0].surgeries30, rows[1].surgeries30]).toEqual([1, 0])
  })
})

describe('warnings', () => {
  const keys = (h: unknown, o = {}) => build([h], o)[0].warnings.map((w) => w.key)
  it('lists no agent, no contact and a quiet client', () => {
    expect(keys(hospital('a', { commercial_status: 'client' }), { meetings: [meeting('a', 1)] })).toEqual(['no-agent', 'no-contact', 'quiet-client'])
  })
  it('a client with a surgery is not quiet', () => {
    expect(keys(hospital('a', { commercial_status: 'client', hospital_agents: [agent('u')], contacts: [{ phone: '' }] }), { meetings: [meeting('a', 1)], scans: [scan('a', 1)] })).toEqual([])
  })
  it('a suggested client (Mako) without surgeries is also quiet', () => {
    expect(keys(hospital('a', { hospital_robotic_systems: [robot('Mako')], hospital_agents: [agent('u')], contacts: [{ phone: '' }] }), { meetings: [meeting('a', 1)] })).toEqual(['quiet-client'])
  })
  it('an irrelevant hospital never warns', () => {
    expect(keys(hospital('a', { commercial_status: 'irrelevant' }))).toEqual([])
  })
})

describe('contact and counts', () => {
  it('the first contact with a phone is the one to call', () => {
    const [r] = build([hospital('a', { contacts: [{ name: 'א', phone: '' }, { name: 'ב', phone: '050' }, { name: 'ג', phone: '052' }] })])
    expect(r.contactPhone).toEqual({ name: 'ב', phone: '050' })
  })
  it('no phone anywhere means nobody to call', () => {
    expect(build([hospital('a', { contacts: [{ name: 'א', phone: '' }] })])[0].contactPhone).toBeNull()
  })
  it('counts doctors that exist, agents and robots; drops empty links', () => {
    const [r] = build([hospital('a', { doctor_hospitals: [{ doctor: { id: 'd' } }, { doctor: null }], hospital_agents: [agent('u'), { agent: null }], hospital_robotic_systems: [robot('Mako'), { system: null }] })])
    expect([r.doctors, r.agents.length, r.robots]).toEqual([1, 1, ['Mako']])
  })
})
