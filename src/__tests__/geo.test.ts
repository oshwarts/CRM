import { describe, expect, it } from 'vitest'
import { distanceKm, nearestTo } from '../lib/geo'

const hospitals = [
  { id: 'tlv', name: 'איכילוב', lat: 32.0807, lng: 34.7897 },
  { id: 'jer', name: 'הדסה', lat: 31.7683, lng: 35.1495 },
  { id: 'none', name: 'בלי מיקום', lat: null, lng: null },
]

describe('nearest hospital', () => {
  it('measures the distance in km', () => {
    expect(Math.round(distanceKm([32.0853, 34.7818], [31.7683, 35.2137]))).toBe(54) // Tel Aviv to Jerusalem
  })
  it('picks the nearest one that has coordinates', () => {
    expect(nearestTo([32.07, 34.8], hospitals)?.item.id).toBe('tlv')
    expect(nearestTo([31.78, 35.2], hospitals)?.item.id).toBe('jer')
  })
  it('is null when no hospital has coordinates', () => {
    expect(nearestTo([32, 34], [hospitals[2]])).toBeNull()
  })
})
