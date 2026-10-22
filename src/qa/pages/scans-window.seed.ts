// Seed of the scans list: what shows when the screen opens (planned surgeries of the next two weeks) and what stays out of the way
import { d, mkScan, seed } from '../seed'

seed(['patient-scans'], [
  mkScan('w1', 'מטופל לעוד 10 ימים', { surgery_date: d(10), ct_date: d(5) }),
  mkScan('w2', 'מטופל לעוד 3 ימים', { surgery_date: d(3), ct_date: d(1) }),
  mkScan('w3', 'מטופל לעוד 20 יום', { surgery_date: d(20), ct_date: d(8) }),
  mkScan('w4', 'ניתוח שבוצע לפני חודש', { surgery_date: d(-30), ct_date: d(-40), status: 'done', scanned: true }),
  mkScan('w5', 'ניתוח שבוטל', { surgery_date: d(4), status: 'cancelled', notes: 'בוטל מ-26/10/2026: המטופל ויתר' }),
  mkScan('w6', 'ניתוח שנדחה', { surgery_date: null, status: 'postponed', notes: 'נדחה מ-24/10/2026: חדר ניתוח תפוס' }),
  mkScan('w7', 'מטופל בלי תאריך ניתוח', { surgery_date: null, ct_date: null }),
])
