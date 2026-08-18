import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { formatDate } from '../../utils/format.js'

const TABS = [
  { key: 'it_approved', label: 'Awaiting Director Approval' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'it_rejected', label: 'IT Rejected' },
  { key: 'director_rejected', label: 'Director Rejected' },
  { key: 'fully_verified', label: 'Fully Verified' },
]

export default function AdminVerification() {
  const toast = useToast()
  const [tab, setTab] = useState('it_approved')
  const [rows, setRows] = useState(null)
  const [action, setAction] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    setRows(null)
    api.get('/workers', { status: tab, limit: 200 }).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [tab])

  const verify = async () => {
    setLoading(true)
    try {
      await api.post(`/workers/${action.id}/verify`, { level: 'director', decision: action.decision, remarks })
      toast.success(`Profile ${action.decision} at Director level`)
      setAction(null)
      setRemarks('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  if (!rows) return <LoadingPage label="Loading verification queue..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Verification Center</div>
          <div className="page-subtitle">Two-level employee verification — final Director approval</div>
        </div>
      </div>

      <div className="tabs mb-16">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Profiles</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="✅" title="No profiles in this category" />}
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Submitted</th><th>Documents</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/admin/employees/${e.id}`} className="no-underline"><strong>{e.name}</strong></Link>
                    <div className="text-xs text-muted">{e.employee_id} · {e.department || '—'}</div>
                  </td>
                  <td className="text-sm">{formatDate(e.submittedAt)}</td>
                  <td className="text-sm">{e.documentsApproved}/{e.documentsCount} verified</td>
                  <td><StatusBadge status={e.profileStatus} /></td>
                  <td>
                    <Link to={`/admin/employees/${e.id}`} className="btn btn-secondary btn-sm">Review</Link>
                    {tab === 'it_approved' && (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => setAction({ id: e.id, decision: 'rejected' })}>Reject</button>
                        <button className="btn btn-success btn-sm" onClick={() => setAction({ id: e.id, decision: 'approved' })}>Approve</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!action} onClose={() => setAction(null)} title={action?.decision === 'approved' ? 'Final Approval' : 'Reject Profile'}>
        {action?.decision === 'approved' ? (
          <>
            <p className="text-sm text-muted mb-16">Approving at Director level marks this employee as <strong>fully verified</strong> in the system.</p>
            <div className="field">
              <label>Remarks (optional)</label>
              <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted mb-16">Rejecting sends the profile back to the worker with your reason.</p>
            <div className="field">
              <label>Reason (required)</label>
              <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Bank details do not match the provided proof" />
            </div>
          </>
        )}
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
          <button
            className={`btn ${action?.decision === 'approved' ? 'btn-success' : 'btn-danger'}`}
            disabled={loading || (action?.decision === 'rejected' && !remarks.trim())}
            onClick={verify}
          >
            {loading ? 'Processing...' : `Confirm ${action?.decision === 'approved' ? 'Approval' : 'Rejection'}`}
          </button>
        </div>
      </Modal>
    </div>
  )
}