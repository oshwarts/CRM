// Phone push notifications: a device subscribes once (per browser), the subscription is saved in Supabase, and the
// send-task-reminders edge function (woken by pg_cron) delivers to it later, even with the app fully closed.
import { supabase } from './supabase'
import { currentUserId } from './outbox'

/** the VAPID public key, base64url, converted to the raw byte array pushManager.subscribe() expects */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!import.meta.env.VITE_VAPID_PUBLIC_KEY
}

/** this device's current standing: never asked, asked and refused, or already subscribed */
export async function pushStatus(): Promise<'unsupported' | 'denied' | 'subscribed' | 'off'> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  return sub ? 'subscribed' : 'off'
}

/** asks for permission (if needed) and saves this device's subscription — call from a click handler, not on load */
export async function enablePush(): Promise<'subscribed' | 'denied' | 'unsupported'> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!pushSupported() || !vapidKey) return 'unsupported'
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource }))

  const json = sub.toJSON()
  const userId = await currentUserId()
  if (!userId || !json.keys?.p256dh || !json.keys?.auth) return 'denied'
  await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent }, { onConflict: 'endpoint' })
  return 'subscribed'
}
