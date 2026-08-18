import { useEffect, useState, useRef } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDate } from '../../utils/format.js'
import { LEAVE_TYPE_LABELS, LEAVE_TYPES } from '../../../../shared/constants.js'

const MAX_SIZE = 2 * 1024 * 1024

export default function WorkerLeaves() {
  const toast = useToast()
  const [balances, setBalances] = useState(null)
  const [leaves, setLeaves] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ leaveType: 'casual', startDate: '', endDate: '', halfDay: 'none', reason: '', comments: '' })
  const fileRef = useRef(null)

  const load = () => {
    api.get('/leaves/mine').then((res) => setLeaves(res.data.rows))
    api.get('/leaves/balances').then((res) => setBalances(res.data.rows))
  }
  useEffect(load, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setSubmitting(true)
    try {
      await api.post('/leaves', form)
      toast.success('Leave request submitted')
      setShowForm(false)
      setForm({ leaveType: 'casual', startDate: '', endDate: '', halfDay: 'none', reason: '', comments: '' })
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const cancelLeave = async (id) => {
    try {
      await api.post(`/leaves/${id}/cancel`)
      toast.success('Leave request cancelled')
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  if (!balances || !leaves) return <LoadingPage label="Loading leave data..." />

  const balanceOf = (t) => balances.find((b) => b.leaveType === t)
  const selBalance = balanceOf(form.leaveType)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Leave Management</div>
          <div className="page-subtitle">Apply for leave, work from home, or half days</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Apply for Leave</button>
      </div>

      <div className="grid grid-4 mb-16">
        {LEAVE_TYPES.map((t) => {
          const b = balanceOf(t)
          return (
            <div key={t} className="card card-pad">
              <div className="text-sm text-muted">{LEAVE_TYPE_LABELS[t]}</div>
              <div className="mt-8">
                <span className="font-bold" style={{ fontSize: 24 }}>{Number(b?.remaining ?? 0)}</span>
                <span className="text-sm text-muted"> / {Number(b?.total ?? 0)} left</span>
              </div>
              <div className="text-xs text-muted mt-8">Used: {Number(b?.used ?? 0)}</div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">My Leave Requests</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {leaves.length === 0 && <EmptyState icon="🌴" title="No leave requests yet" sub="Click 'Apply for Leave' to request time off." />}
          <table className="table">
            <thead>
              <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td>{LEAVE_TYPE_LABELS[l.leaveType]}</td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>{formatDate(l.endDate)}</td>
                  <td>{Number(l.days)}</td>
                  <td className="text-sm text-muted" style={{ maxWidth: 220 }}>{l.reason || '—'}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetail(l)}>Details</button>
                    {['pending_it', 'it_approved', 'pending_director', 'draft'].includes(l.status) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => cancelLeave(l.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Apply for Leave" wide>
        <div className="form-row">
          <Field field={{ name: 'leaveType', label: 'Leave Type', type: 'select', options: LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABELS[t] })) }} value={form.leaveType} onChange={set} />
          <Field field={{ name: 'startDate', label: 'Start Date', type: 'date', required: true }} value={form.startDate} onChange={set} />
          <Field field={{ name: 'endDate', label: 'End Date', type: 'date', required: true, disabled: form.leaveType === 'half_day' }} value={form.endDate} onChange={set} />
        </div>
        {form.leaveType === 'half_day' && (
          <div className="form-row">
            <Field field={{ name: 'halfDay', label: 'Half Day', type: 'select', options: [{ value: 'first', label: 'First Half' }, { value: 'second', label: 'Second Half' }] }} value={form.halfDay} onChange={set} />
          </div>
        )}
        <div className="form-row">
          <Field field={{ name: 'reason', label: 'Reason', type: 'text', required: true }} value={form.reason} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'comments', label: 'Comments', type: 'textarea' }} value={form.comments} onChange={set} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Supporting Document (optional)</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="input" onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return
              if (file.size > MAX_SIZE) { toast.error('File must be under 2 MB'); return }
              const buf = await file.arrayBuffer()
              let bin = ''
              const bytes = new Uint8Array(buf)
              for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
              setForm((f) => ({ ...f, supportingDocName: file.name, supportingDocContent: btoa(bin) }))
              toast.success(`Attached: ${file.name}`)
            }} />
          </div>
        </div>
        {selBalance && (
          <div className={`card-pad ${Number(selBalance.remaining) > 0 ? 'mb-0' : ''}`} style={{ background: Number(selBalance.remaining) > 0 ? 'var(--success-light)' : 'var(--danger-light)', borderRadius: 8, marginBottom: 16 }}>
            <span className="text-sm">
              {LEAVE_TYPE_LABELS[form.leaveType]} balance: <strong>{Number(selBalance.remaining)}</strong> remaining
            </span>
          </div>
        )}
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={submitting || !form.startDate || !form.reason} onClick={submit}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Leave Details">
        {detail && (
          <div className="detail-stack">
            <div className="detail-item"><div className="k">Type</div><div className="v">{LEAVE_TYPE_LABELS[detail.leaveType]}</div></div>
            <div className="detail-item"><div className="k">Dates</div><div className="v">{formatDate(detail.startDate)} → {formatDate(detail.endDate)}</div></div>
            <div className="detail-item"><div className="k">Days</div><div className="v">{Number(detail.days)}</div></div>
            <div className="detail-item"><div className="k">Reason</div><div className="v">{detail.reason || '—'}</div></div>
            <div className="detail-item"><div className="k">Status</div><div className="v"><StatusBadge status={detail.status} /></div></div>
            {detail.itReviewedByName && <div className="detail-item"><div className="k">IT Review</div><div className="v">{detail.itReviewedByName} · {detail.itRemarks || 'no remarks'}</div></div>}
            {detail.directorReviewedByName && <div className="detail-item"><div className="k">Director Review</div><div className="v">{detail.directorReviewedByName} · {detail.directorRemarks || 'no remarks'}</div></div>}
            {detail.supportingDocName && <div className="detail-item"><div className="k">Attachment</div><div className="v">{detail.supportingDocName}</div></div>}
          </div>
        )}
      </Modal>
    </div>
  )
}