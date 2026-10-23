// Where the user is, and which of the places is the nearest. The position stays on the device: it is only used to pick a default.
import { useEffect, useState } from 'react'

export type LatLng = [number, number]

/** distance in km between two coordinates */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** the nearest place that has coordinates (null when none has) */
export function nearestTo<T extends { id: string; lat: number | null; lng: number | null }>(pos: LatLng, items: T[]): { item: T; km: number } | null {
  let best: { item: T; km: number } | null = null
  for (const item of items) {
    if (item.lat == null || item.lng == null) continue
    const km = distanceKm(pos, [item.lat, item.lng])
    if (!best || km < best.km) best = { item, km }
  }
  return best
}

export type Geo = { state: 'off' | 'asking' | 'ok' | 'denied'; pos: LatLng | null }

/** asks for the position once (when `enabled`); 'denied' also covers a browser without it and a slow answer */
export function useUserPosition(enabled: boolean): Geo {
  const [geo, setGeo] = useState<Geo>({ state: enabled ? 'asking' : 'off', pos: null })
  useEffect(() => {
    if (!enabled) return
    if (!navigator.geolocation) {
      setGeo({ state: 'denied', pos: null })
      return
    }
    let live = true
    navigator.geolocation.getCurrentPosition(
      (r) => live && setGeo({ state: 'ok', pos: [r.coords.latitude, r.coords.longitude] }),
      () => live && setGeo({ state: 'denied', pos: null }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
    return () => {
      live = false
    }
  }, [enabled])
  return geo
}
