import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { formatDate } from '../../utils/format.js'
import { LEAVE_TYPE_LABELS } from '../../../../shared/constants.js'

function isoDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA')
}

export default function ItEmergencyUnblock() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [adjust, setAdjust] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = () => {
    api.get('/leaves/active').then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [])

  const unblock = async (employeeId, name) => {
    if (!window.confirm(`Unblock login for ${name}? Their account will open in both apps (Site + HRCRM) until their leave ends.`)) return
    setBusy(true)
    try {
      await api.post(`/leaves/${employeeId}/unblock`)
      toast.success(`Login unblocked for ${name}`)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  const reblock = async (employeeId, name) => {
    if (!window.confirm(`Block login again for ${name}? They will not be able to log in while on leave.`)) return
    setBusy(true)
    try {
      await api.del(`/leaves/${employeeId}/unblock`)
      toast.success(`Login blocked again for ${name}`)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  const openAdjust = (row) => {
    setAdjust(row)
    setStartDate(isoDate(row.startDate))
    setEndDate(isoDate(row.endDate))
  }

  const saveAdjust = async () => {
    if (!startDate || !endDate) {
      toast.error('Please enter both dates')
      return
    }
    setBusy(true)
    try {
      await api.put(`/leaves/${adjust.id}/dates`, { startDate, endDate })
      toast.success('Leave dates updated')
      setAdjust(null)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!rows) return <LoadingPage label="Loading workers on leave..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Emergency Worker Unblock</div>
          <div className="page-subtitle">Workers currently on approved leave — their login is automatically blocked in both apps (Site + HRCRM).</div>
        </div>
      </div>

      <div className="card mb-16" style={{ background: 'var(--amber-50, #fffbeb)' }}>
        <div className="card-body text-sm">
          ⚡ Use <strong>Unblock Login</strong> only in an emergency — the worker can log in again until their leave ends, and it unblocks automatically.
          Use <strong>Adjust Dates</strong> to shorten or extend an approved leave.
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">On Leave Now</div>
          <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="🌴" title="No workers on approved leave right now" />}
          {rows.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Login Status</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link to={`/it/workers/${l.employeeId}`} className="no-underline"><strong>{l.employeeName}</strong></Link>
                      <div className="text-xs text-muted">{l.employeeCode}</div>
                    </td>
                    <td className="text-sm">{LEAVE_TYPE_LABELS[l.leaveType]}</td>
                    <td className="text-sm">{formatDate(l.startDate)}</td>
                    <td className="text-sm">{formatDate(l.endDate)}</td>
                    <td>{Number(l.days)}</td>
                    <td>
                      {l.isUnblocked ? (
                        <span className="badge badge-success">Unblocked till {formatDate(l.unblockedUntil)}</span>
                      ) : (
                        <span className="badge badge-danger">Login blocked</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {l.isUnblocked ? (
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => reblock(l.employeeId, l.employeeName)}>🔒 Re-block</button>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => unblock(l.employeeId, l.employeeName)}>⚡ Unblock Login</button>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => openAdjust(l)}>✏️ Adjust Dates</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title={`Adjust Leave — ${adjust?.employeeName || ''}`}>
        <p className="text-sm text-muted mb-16">Shorten or extend the approved leave. Leave days and balances are recalculated automatically.</p>
        <div className="field">
          <label className="field-label">Start Date</label>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">End Date</label>
          <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setAdjust(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={saveAdjust}>Save Changes</button>
        </div>
      </Modal>
    </div>
  )
}