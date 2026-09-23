import { useMemo, useState } from 'react'
import {
  useDoctors,
  useImplantOptions,
  useMakoHospitals,
  useUpsertPatientScan,
} from '../lib/api'
import {
  HEALTH_FUNDS,
  IMPLANT_FIELDS,
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { Field, Modal } from './ui'

type Draft = {
  hospital_id: string
  surgery_date: string
  patient_name: string
  patient_phone: string
  patient_id_number: string
  patient_dob: string
  health_fund: string
  insurance: string
  surgeon_id: string
  procedure_type: 'knee' | 'uni' | 'hip'
  side: string
  ct_date: string
  ct_time: string
  anaesthesia_note: string
  scanned: boolean
  disk_collected: boolean
  uploaded: boolean
  status: string
  implant_data: Record<string, string>
  notes: string
}

function toDraft(s?: PatientScanRow): Draft {
  return {
    hospital_id: s?.hospital_id ?? '',
    surgery_date: s?.surgery_date ?? '',
    patient_name: s?.patient_name ?? '',
    patient_phone: s?.patient_phone ?? '',
    patient_id_number: s?.patient_id_number ?? '',
    patient_dob: s?.patient_dob ?? '',
    health_fund: s?.health_fund ?? '',
    insurance: s?.insurance ?? '',
    surgeon_id: s?.surgeon_id ?? '',
    procedure_type: (s?.procedure_type as Draft['procedure_type']) ?? 'knee',
    side: s?.side ?? '',
    ct_date: s?.ct_date ?? '',
    ct_time: s?.ct_time?.slice(0, 5) ?? '',
    anaesthesia_note: s?.anaesthesia_note ?? '',
    scanned: s?.scanned ?? false,
    disk_collected: s?.disk_collected ?? false,
    uploaded: s?.uploaded ?? false,
    status: s?.status ?? 'planned',
    implant_data: (s?.implant_data as Record<string, string>) ?? {},
    notes: s?.notes ?? '',
  }
}

export function ScanFormModal({
  scan,
  onClose,
}: {
  scan?: PatientScanRow
  onClose: () => void
}) {
  const hospitals = useMakoHospitals()
  const doctors = useDoctors()
  const options = useImplantOptions()
  const save = useUpsertPatientScan()

  const [d, setD] = useState<Draft>(() => toDraft(scan))
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  const implantFields = IMPLANT_FIELDS[d.procedure_type] ?? []
  const optsByCat = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const o of options.data ?? []) (m[o.category] ??= []).push(o.value)
    return m
  }, [options.data])

  async function submit() {
    setError(null)
    if (!d.hospital_id) return setError('בחר בית חולים')
    if (!d.patient_name.trim()) return setError('הזן שם מטופל')
    if (d.status === 'done' && !d.surgeon_id)
      return setError('ניתוח שבוצע — יש לשייך מנתח')
    try {
      await save.mutateAsync({
        id: scan?.id,
        hospital_id: d.hospital_id,
        surgery_date: d.surgery_date || null,
        patient_name: d.patient_name.trim(),
        patient_phone: d.patient_phone.trim(),
        patient_id_number: d.patient_id_number.trim(),
        patient_dob: d.patient_dob || null,
        health_fund: d.health_fund,
        insurance: d.insurance.trim(),
        surgeon_id: d.surgeon_id || null,
        procedure_type: d.procedure_type,
        side: d.side,
        ct_date: d.ct_date || null,
        ct_time: d.ct_time || null,
        anaesthesia_note: d.anaesthesia_note.trim(),
        scanned: d.scanned,
        disk_collected: d.disk_collected,
        uploaded: d.uploaded,
        status: d.status,
        implant_data: d.implant_data,
        notes: d.notes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={scan ? 'עריכת מטופל' : 'הוספת מטופל'} size="xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="בית חולים (MAKO)">
            <select className="input" value={d.hospital_id} onChange={(e) => set({ hospital_id: e.target.value })}>
              <option value="">בחר…</option>
              {(hospitals.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="תאריך ניתוח">
            <input type="date" className="input" value={d.surgery_date} onChange={(e) => set({ surgery_date: e.target.value })} />
          </Field>
          <Field label="סטטוס">
            <select className="input" value={d.status} onChange={(e) => set({ status: e.target.value })}>
              {Object.entries(SCAN_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="שם מלא">
            <input className="input" value={d.patient_name} onChange={(e) => set({ patient_name: e.target.value })} />
          </Field>
          <Field label="ת״ז">
            <input dir="ltr" className="input text-right" value={d.patient_id_number} onChange={(e) => set({ patient_id_number: e.target.value })} />
          </Field>
          <Field label="טלפון">
            <input dir="ltr" className="input text-right" value={d.patient_phone} onChange={(e) => set({ patient_phone: e.target.value })} />
          </Field>
          <Field label="תאריך לידה">
            <input type="date" className="input" value={d.patient_dob} onChange={(e) => set({ patient_dob: e.target.value })} />
          </Field>
          <Field label="קופת חולים">
            <select className="input" value={d.health_fund} onChange={(e) => set({ health_fund: e.target.value })}>
              <option value="">—</option>
              {HEALTH_FUNDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="חברת ביטוח">
            <input className="input" value={d.insurance} onChange={(e) => set({ insurance: e.target.value })} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="מנתח">
            <select className="input" value={d.surgeon_id} onChange={(e) => set({ surgeon_id: e.target.value })}>
              <option value="">בחר רופא…</option>
              {(doctors.data ?? []).map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title} {doc.name}</option>
              ))}
            </select>
          </Field>
          <Field label="סוג ניתוח">
            <select
              className="input"
              value={d.procedure_type}
              onChange={(e) => set({ procedure_type: e.target.value as Draft['procedure_type'], implant_data: {} })}
            >
              {Object.entries(SCAN_PROCEDURE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="רגל">
            <select className="input" value={d.side} onChange={(e) => set({ side: e.target.value })}>
              <option value="">—</option>
              <option value="ימין">ימין</option>
              <option value="שמאל">שמאל</option>
            </select>
          </Field>
          <Field label="תאריך CT">
            <input type="date" className="input" value={d.ct_date} onChange={(e) => set({ ct_date: e.target.value })} />
          </Field>
          <Field label="שעת CT">
            <input type="time" className="input" value={d.ct_time} onChange={(e) => set({ ct_time: e.target.value })} />
          </Field>
          <Field label="תאריך ושעה מרדים">
            <input className="input" value={d.anaesthesia_note} onChange={(e) => set({ anaesthesia_note: e.target.value })} placeholder="לדוגמה: 12.8.26 שעה 10:20" />
          </Field>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={d.scanned} onChange={(e) => set({ scanned: e.target.checked })} />
            נסרק
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={d.disk_collected} onChange={(e) => set({ disk_collected: e.target.checked })} />
            דיסק נאסף
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={d.uploaded} onChange={(e) => set({ uploaded: e.target.checked })} />
            הועלה
          </label>
        </div>

        <div>
          <p className="label">מידות שתל ({SCAN_PROCEDURE_LABELS[d.procedure_type]})</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {implantFields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  className="input"
                  list={`impl-${f.category}`}
                  value={d.implant_data[f.key] ?? ''}
                  onChange={(e) =>
                    set({ implant_data: { ...d.implant_data, [f.key]: e.target.value } })
                  }
                />
                <datalist id={`impl-${f.category}`}>
                  {(optsByCat[f.category] ?? []).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </Field>
            ))}
          </div>
        </div>

        <Field label="הערות">
          <textarea className="input min-h-16" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button className="btn-secondary" onClick={onClose}>ביטול</button>
        <button className="btn-primary" onClick={submit} disabled={save.isPending}>שמירה</button>
      </div>
    </Modal>
  )
}
