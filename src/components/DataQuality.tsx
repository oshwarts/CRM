import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, GitMerge } from 'lucide-react'
import { useContacts, useDoctors, useHospitals } from '../lib/api'
import { supabase } from '../lib/supabase'
import { findDuplicates, type QRecord } from '../lib/dataQuality'
import { ConfirmButton, Spinner } from './ui'
import { classNames } from '../lib/utils'

type Kind = 'doctors' | 'contacts' | 'hospitals'
const KIND_LABEL: Record<Kind, string> = { doctors: 'רופאים', contacts: 'אנשי קשר', hospitals: 'בתי חולים' }

function useMerge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: { table: Kind; keep: string; drop: string }) => {
      const { error } = await supabase.rpc('merge_records', { p_table: m.table, p_keep: m.keep, p_drop: m.drop })
      if (error) throw error
    },
    // meetings, tasks, scans … all point at the merged record
    onSuccess: () => qc.invalidateQueries(),
  })
}

function DupGroup({ kind, group }: { kind: Kind; group: QRecord[] }) {
  const merge = useMerge()
  const [keep, setKeep] = useState(group[0].id)
  const [error, setError] = useState('')
  const link = (r: QRecord) => (kind === 'doctors' ? `/doctors/${r.id}` : null)
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <ul className="space-y-1.5">
        {group.map((r) => (
          <li key={r.id} className={classNames('rounded-lg text-sm', keep === r.id && 'bg-brand-50')}>
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 px-2 py-2">
            <input type="radio" name={`keep-${group[0].id}`} checked={keep === r.id} onChange={() => setKeep(r.id)} className="mt-0.5 h-5 w-5 shrink-0" aria-label={`השאר את ${r.name}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800">
                {link(r) ? (
                  <Link to={link(r)!} className="hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
              </p>
              <p className="text-xs text-slate-500">
                {[r.phone, r.office_phone ? `משרד ${r.office_phone}` : '', r.email, r.detail].filter(Boolean).join(' · ') || 'ללא פרטים'}
              </p>
            </div>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">הרשומה המסומנת נשארת; פרטים חסרים בה יושלמו מהאחרות וכל הקישורים (פגישות, משימות, סריקות…) יעברו אליה.</p>
        <ConfirmButton
          className="btn-primary max-sm:w-full"
          message={`לאחד ${group.length} רשומות לרשומה אחת? הפעולה אינה הפיכה.`}
          onConfirm={async () => {
            setError('')
            try {
              for (const r of group.filter((x) => x.id !== keep)) await merge.mutateAsync({ table: kind, keep, drop: r.id })
            } catch (e) {
              setError(e instanceof Error ? e.message : 'האיחוד נכשל')
            }
          }}
        >
          <GitMerge size={16} /> {merge.isPending ? 'מאחד…' : 'אחד'}
        </ConfirmButton>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

/** managers: records with missing details and duplicates that can be merged into one */
export function DataQuality() {
  const doctors = useDoctors()
  const contacts = useContacts()
  const hospitals = useHospitals()

  const data = useMemo(() => {
    const hospitalName = new Map((hospitals.data ?? []).map((h) => [h.id, h.name]))
    const doctorRecs: QRecord[] = (doctors.data ?? []).map((d) => ({
      id: d.id,
      name: `${d.title ? `${d.title} ` : ''}${d.name}`.trim(),
      phone: d.phone,
      email: d.email,
      detail: d.doctor_hospitals.map((x) => hospitalName.get(x.hospital_id)).filter(Boolean).join(', '),
    }))
    const contactRecs: QRecord[] = (contacts.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      office_phone: c.office_phone,
      email: c.email,
      hospital_id: c.hospital_id,
      doctor_id: c.doctor_id,
      detail: [c.role, c.hospital_id ? hospitalName.get(c.hospital_id) : ''].filter(Boolean).join(' · '),
    }))
    const hospitalRecs: QRecord[] = (hospitals.data ?? []).map((h) => ({ id: h.id, name: h.name, phone: '', email: '' }))
    return {
      noContactDoctors: (doctors.data ?? []).filter((d) => !d.phone.trim() && !d.email.trim()),
      noHospitalDoctors: (doctors.data ?? []).filter((d) => d.doctor_hospitals.length === 0),
      noPhoneContacts: (contacts.data ?? []).filter((c) => !c.phone.trim() && !c.office_phone.trim() && !c.email.trim()),
      dups: {
        doctors: findDuplicates(doctorRecs),
        contacts: findDuplicates(contactRecs, { byContactLink: true }),
        hospitals: findDuplicates(hospitalRecs),
      } as Record<Kind, QRecord[][]>,
    }
  }, [doctors.data, contacts.data, hospitals.data])

  if (doctors.isLoading || contacts.isLoading || hospitals.isLoading) return <Spinner />

  const issues = data.noContactDoctors.length + data.noHospitalDoctors.length + data.noPhoneContacts.length
  const dupTotal = data.dups.doctors.length + data.dups.contacts.length + data.dups.hospitals.length

  const missing = (title: string, list: { id: string; name: string; title?: string }[], to: (id: string) => string | null) =>
    list.length > 0 && (
      <details className="card p-4">
        <summary className="cursor-pointer py-1 text-sm font-medium text-slate-700">
          <AlertTriangle size={14} className="ml-1 inline text-amber-500" />
          {title} ({list.length})
        </summary>
        <ul className="mt-2 grid gap-x-4 text-sm sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="py-1">
              {to(r.id) ? (
                <Link to={to(r.id)!} className="text-brand-700 hover:underline">
                  {r.title ? `${r.title} ` : ''}
                  {r.name}
                </Link>
              ) : (
                <span>{r.name}</span>
              )}
            </li>
          ))}
        </ul>
      </details>
    )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        כאן רואים רשומות עם פרטים חסרים, וכפילויות שאפשר לאחד. הזיהוי הוא הצעה בלבד: שם זהה, טלפון או אימייל משותפים עם מילה משותפת בשם.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['רופאים בלי טלפון ואימייל', data.noContactDoctors.length],
          ['רופאים בלי בית חולים', data.noHospitalDoctors.length],
          ['אנשי קשר בלי פרטי קשר', data.noPhoneContacts.length],
          ['קבוצות כפילויות', dupTotal],
        ].map(([label, n]) => (
          <div key={label as string} className="card p-3">
            <p className={classNames('text-2xl font-bold', (n as number) > 0 ? 'text-amber-600' : 'text-emerald-600')}>{n}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {issues === 0 && dupTotal === 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> לא נמצאו פרטים חסרים או כפילויות.
        </p>
      )}

      {missing('רופאים בלי טלפון ואימייל', data.noContactDoctors, (id) => `/doctors/${id}`)}
      {missing('רופאים בלי בית חולים', data.noHospitalDoctors, (id) => `/doctors/${id}`)}
      {missing('אנשי קשר בלי טלפון, טלפון משרד או אימייל', data.noPhoneContacts, () => null)}

      {(Object.keys(data.dups) as Kind[]).map(
        (k) =>
          data.dups[k].length > 0 && (
            <section key={k} className="space-y-2">
              <h2 className="text-base font-semibold text-slate-800">
                כפילויות — {KIND_LABEL[k]} ({data.dups[k].length})
              </h2>
              <ul className="space-y-2">
                {data.dups[k].map((g) => (
                  <DupGroup key={g.map((r) => r.id).join('-')} kind={k} group={g} />
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  )
}
