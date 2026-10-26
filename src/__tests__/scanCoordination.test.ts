import { describe, expect, it } from 'vitest'
import { isPrivate, looksLikeEmail, parseSecretary, scanRoute, stringifySecretary, telHref, whatsappHref, type ScanHospital } from '../lib/scanCoordination'

const base: ScanHospital = { sector: 'public', scan_contact_id: null, scan_center_name: '', scan_hours: '', scan_notes: '', scan_phone: '', scan_email: '', scan_whatsapp_name: '', scan_whatsapp_url: '' }
const contacts = [{ id: 'c1', name: 'רחל', role: 'מזכירה', phone: '050-1111111', email: 'r@h.test' }]
const ami = { name: 'דנה', phone: '052-2222222', email: 'dana@ami.test' }

describe('who coordinates the scan', () => {
  it('public: the hospital secretary is the first to approach', () => {
    const r = scanRoute({ ...base, scan_contact_id: 'c1', scan_hours: 'א׳–ה׳ עד 15:00' }, contacts, ami)
    expect(r.mode).toBe('public')
    expect(r.first).toMatchObject({ name: 'רחל', phone: '050-1111111' })
    expect(r.hours).toBe('א׳–ה׳ עד 15:00')
    expect(r.empty).toBe(false)
  })
  it('public: a phone typed for scheduling wins over the contact\'s own phone', () => {
    expect(scanRoute({ ...base, scan_contact_id: 'c1', scan_phone: '03-5551234' }, contacts, ami).first?.phone).toBe('03-5551234')
  })
  it('public without anything is empty and says so', () => {
    const r = scanRoute(base, contacts, ami)
    expect(r.empty).toBe(true)
    expect(r.first).toBeNull()
  })
  it('private: the AMI secretary is first, the imaging center is who she works with', () => {
    const r = scanRoute({ ...base, sector: 'private', scan_contact_id: 'c1', scan_center_name: 'מכון דימות א', scan_whatsapp_name: 'תיאום CT', scan_whatsapp_url: 'https://chat.whatsapp.com/abc' }, contacts, ami)
    expect(r.mode).toBe('private')
    expect(r.first).toMatchObject({ name: 'דנה', phone: '052-2222222' })
    expect(r.imaging.center).toBe('מכון דימות א')
    expect(r.imaging.contact?.name).toBe('רחל')
    expect(r.imaging.whatsappUrl).toBe('https://chat.whatsapp.com/abc')
  })
  it('private without an AMI secretary tells the manager to set her', () => {
    const r = scanRoute({ ...base, sector: 'private' }, contacts, { name: '', phone: '', email: '' })
    expect(r.first).toBeNull()
    expect(r.instruction).toContain('לא הוגדרה')
  })
  it('a hospital with no sector is treated as public', () => {
    expect(isPrivate({ sector: '' })).toBe(false)
    expect(isPrivate({ sector: 'private' })).toBe(true)
  })
})

describe('typed contact details', () => {
  it('opens only WhatsApp links', () => {
    expect(whatsappHref('https://chat.whatsapp.com/Abc123')).toBe('https://chat.whatsapp.com/Abc123')
    expect(whatsappHref('https://wa.me/972501234567')).toBe('https://wa.me/972501234567')
    expect(whatsappHref('javascript:alert(1)')).toBeNull()
    expect(whatsappHref('http://chat.whatsapp.com/x')).toBeNull()
    expect(whatsappHref('https://evil.test/chat.whatsapp.com/x')).toBeNull()
    expect(whatsappHref('')).toBeNull()
  })
  it('checks the e-mail shape and cleans the phone for tel:', () => {
    expect(looksLikeEmail('a@b.co')).toBe(true)
    expect(looksLikeEmail('a@b')).toBe(false)
    expect(telHref('050-123 4567')).toBe('tel:0501234567')
    expect(telHref('+972 (50) 123-4567')).toBe('tel:+972501234567')
  })
  it('keeps the AMI secretary as JSON and survives a broken value', () => {
    expect(parseSecretary(stringifySecretary({ name: ' דנה ', phone: '052', email: '' }))).toEqual({ name: 'דנה', phone: '052', email: '' })
    expect(parseSecretary('not json')).toEqual({ name: '', phone: '', email: '' })
    expect(parseSecretary('')).toEqual({ name: '', phone: '', email: '' })
  })
})
