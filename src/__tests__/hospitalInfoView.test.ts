import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { HospitalInfo } from '../components/HospitalInfo'

// the tab of a hospital with its data already loaded: what the person sees at first
describe('the hospital information tab', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  qc.setQueryData(['hospital-locations', 'h1'], [
    { id: 'l1', hospital_id: 'h1', title: 'מנהל מחלקה אורתופדית', person: 'פרופ׳ לוי', place: 'בניין ב׳, קומה 3, חדר 312', note: '', sort: 0 },
    { id: 'l2', hospital_id: 'h1', title: 'חדר ניתוח 3', person: '', place: '', note: '', sort: 1 },
  ])
  qc.setQueryData(['hospital-estimates', 'h1'], [
    { id: 'e1', hospital_id: 'h1', procedure_id: null, procedure_text: 'החלפת ברך', cases: 120, period: 'year', note: '' },
    { id: 'e2', hospital_id: 'h1', procedure_id: null, procedure_text: 'יוני', cases: 5, period: 'month', note: '' },
  ])
  qc.setQueryData(['hospital-general-info', 'h1'], 'חניה בכניסה הדרומית')
  qc.setQueryData(['procedures'], [])
  const html = renderToString(createElement(QueryClientProvider, { client: qc }, createElement(HospitalInfo, { hospitalId: 'h1' })))

  it('shows where the head of the department sits, and says so when a place has no location', () => {
    expect(html).toContain('מנהל מחלקה אורתופדית')
    expect(html).toContain('בניין ב׳, קומה 3, חדר 312')
    expect(html).toContain('לא צוין מיקום')
  })
  it('shows the estimates by procedure and the total a year', () => {
    expect(html).toContain('החלפת ברך')
    expect(html).toContain('120')
    expect(html).toContain('בחודש')
    expect(html).toMatch(/180/) // 120 + 5 a month x 12
  })
  it('has the general information box and the add buttons', () => {
    expect(html).toContain('מידע כללי')
    expect(html).toContain('הוסף מיקום')
    expect(html).toContain('הוסף הליך')
  })
})
