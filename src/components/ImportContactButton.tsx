import { useRef, useState } from 'react'
import { BookUser, FileUp } from 'lucide-react'
import {
  canPickContacts,
  parseVcard,
  pickFromDevice,
  type Candidate,
} from '../lib/contactImport'

export type PickedContact = { name: string; phone: string; email: string }

/**
 * Fills phone / e-mail (and name) from the phone's contacts.
 *  - Android Chrome: opens the device contact picker.
 *  - everywhere else (iPhone, Outlook, desktop): choose a saved contact card (.vcf).
 */
export function ImportContactButton({ onPick }: { onPick: (c: PickedContact) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cands, setCands] = useState<Candidate[]>([])
  const [ci, setCi] = useState(0)
  const [tel, setTel] = useState('')
  const [mail, setMail] = useState('')
  const [msg, setMsg] = useState('')

  function offer(list: Candidate[]) {
    setMsg('')
    if (list.length === 0) {
      setCands([])
      setMsg('לא נמצא איש קשר בבחירה.')
      return
    }
    const only = list[0]
    if (list.length === 1 && only.tels.length <= 1 && only.emails.length <= 1) {
      done(only, only.tels[0] ?? '', only.emails[0] ?? '')
      return
    }
    setCands(list)
    setCi(0)
    setTel(list[0].tels[0] ?? '')
    setMail(list[0].emails[0] ?? '')
  }

  function done(c: Candidate, phone: string, email: string) {
    onPick({ name: c.name, phone, email })
    setCands([])
  }

  function choose(i: number) {
    setCi(i)
    setTel(cands[i].tels[0] ?? '')
    setMail(cands[i].emails[0] ?? '')
  }

  async function fromDevice() {
    try {
      offer(await pickFromDevice())
    } catch {
      // the user closed the picker — nothing to do
    }
  }

  async function fromFile(f: File | undefined) {
    if (!f) return
    offer(parseVcard(await f.text()))
    if (fileRef.current) fileRef.current.value = ''
  }

  const cur = cands[ci]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canPickContacts() && (
          <button type="button" className="btn-secondary max-sm:flex-1" onClick={fromDevice}>
            <BookUser size={16} />
            בחר מאנשי הקשר בטלפון
          </button>
        )}
        <button type="button" className="btn-secondary max-sm:flex-1" onClick={() => fileRef.current?.click()}>
          <FileUp size={16} />
          מילוי מאיש קשר (vCard)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,text/vcard,text/x-vcard,text/directory"
          className="hidden"
          onChange={(e) => fromFile(e.target.files?.[0])}
        />
      </div>
      {!canPickContacts() && (
        <p className="text-xs text-slate-500">
          רוצה למלא טלפון ואימייל מאיש קשר שמור? באייפון / Outlook: שמור אותו כקובץ vCard (.vcf) — "שתף ← שמור בקבצים" — ובחר אותו כאן.
        </p>
      )}
      {msg && <p role="status" className="text-xs text-amber-700">{msg}</p>}

      {cur && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
          {cands.length > 1 && (
            <label className="block">
              <span className="label">איש קשר</span>
              <select className="input" value={ci} onChange={(e) => choose(Number(e.target.value))}>
                {cands.map((c, i) => (
                  <option key={i} value={i}>{c.name || c.tels[0] || c.emails[0] || '—'}</option>
                ))}
              </select>
            </label>
          )}
          {cands.length === 1 && <p className="font-medium text-slate-700">{cur.name}</p>}

          {cur.tels.length > 0 && (
            <fieldset>
              <legend className="label">טלפון</legend>
              {cur.tels.map((t) => (
                <label key={t} className="flex min-h-[36px] items-center gap-2 py-1">
                  <input type="radio" checked={tel === t} onChange={() => setTel(t)} />
                  <span dir="ltr">{t}</span>
                </label>
              ))}
              <label className="flex min-h-[36px] items-center gap-2 py-1 text-slate-500">
                <input type="radio" checked={tel === ''} onChange={() => setTel('')} />
                ללא
              </label>
            </fieldset>
          )}

          {cur.emails.length > 0 && (
            <fieldset>
              <legend className="label">אימייל</legend>
              {cur.emails.map((m) => (
                <label key={m} className="flex min-h-[36px] items-center gap-2 py-1">
                  <input type="radio" checked={mail === m} onChange={() => setMail(m)} />
                  <span dir="ltr">{m}</span>
                </label>
              ))}
              <label className="flex min-h-[36px] items-center gap-2 py-1 text-slate-500">
                <input type="radio" checked={mail === ''} onChange={() => setMail('')} />
                ללא
              </label>
            </fieldset>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCands([])}>ביטול</button>
            <button type="button" className="btn-primary max-sm:flex-1" onClick={() => done(cur, tel, mail)}>החל</button>
          </div>
        </div>
      )}
    </div>
  )
}
