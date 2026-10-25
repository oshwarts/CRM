import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { DoctorExtras } from '../components/DoctorExtras'
import { groupArrangements, kindOf } from '../lib/doctorExtras'

describe('the kind of an arrangement', () => {
  it('knows a fund, an insurer, and anything else', () => {
    expect(kindOf('מכבי')).toBe('fund')
    expect(kindOf(' הראל ')).toBe('insurer')
    expect(kindOf('ביטוח חו״ל כלשהו')).toBe('other')
  })
  it('groups funds, insurers and others', () => {
    const g = groupArrangements([{ kind: 'insurer', provider: 'הראל' }, { kind: 'fund', provider: 'מכבי' }, { kind: 'fund', provider: 'כללית' }])
    expect(g.map((x) => [x.kind, x.items.length])).toEqual([['fund', 2], ['insurer', 1]])
  })
})

describe('the arrangements and roles of a doctor', () => {
  const render = (privateHospital: boolean, withData: boolean) => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
    qc.setQueryData(['doctor-arrangements', 'd1'], withData ? [{ id: 'a1', doctor_id: 'd1', kind: 'fund', provider: 'מכבי', note: '' }, { id: 'a2', doctor_id: 'd1', kind: 'other', provider: 'ביטוח מיוחד', note: '' }] : [])
    qc.setQueryData(['doctor-roles', 'd1'], withData ? [{ id: 'r1', doctor_id: 'd1', title: 'יו״ר האגודה', organization: 'האגודה לאורתופדיה', note: '', sort: 0 }] : [])
    return renderToString(createElement(QueryClientProvider, { client: qc }, createElement(DoctorExtras, { doctorId: 'd1', privateHospital })))
  }
  it('a doctor of a private hospital has the arrangements, with the chosen ones marked and a custom one listed', () => {
    const html = render(true, true)
    expect(html).toContain('הסדרים עם קופות חולים וביטוחים')
    expect(html).toContain('ביטוח מיוחד')
    expect(html).toMatch(/aria-pressed="true"[^>]*>מכבי/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>הראל/)
  })
  it('shows the further roles of the doctor', () => {
    const html = render(true, true)
    expect(html).toContain('יו״ר האגודה')
    expect(html).toContain('האגודה לאורתופדיה')
  })
  it('a doctor of public hospitals only does not show the arrangements (unless he already has some), but has the roles', () => {
    const none = render(false, false)
    expect(none).not.toContain('הסדרים עם קופות חולים וביטוחים"')
    expect(none).toContain('תפקידים נוספים')
    expect(render(false, true)).toContain('הסדרים עם קופות חולים וביטוחים')
  })
})
