import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { formatDate } from '../../utils/format.js'
import { LEAVE_TYPE_LABELS } from '../../../../shared/constants.js'

export default function ItLeaves() {
  const toast = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState(user.role === 'director' ? 'it_approved' : 'pending_it')
  const [detail, setDetail] = useState(null)
  const [decisionModal, setDecisionModal] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    api.get('/leaves', { status: filter, limit: 200 }).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [filter])

  const review = async () => {
    setLoading(true)
    try {
      await api.put(`/leaves/${decisionModal.id}/review`, { level: user.role === 'director' ? 'director' : 'it', decision: decisionModal.decision, remarks })
      toast.success('Leave request reviewed')
      setDecisionModal(null)
      setRemarks('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  if (!rows) return <LoadingPage label="Loading leave requests..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Leave Approvals</div>
          <div className="page-subtitle">{user.role === 'director' ? 'Director level approvals (after IT approval)' : 'Review leave requests from workers'}</div>
        </div>
      </div>

      <div className="tabs mb-16">
        {user.role === 'director' ? (
          <>
            <button className={`tab ${filter === 'it_approved' ? 'active' : ''}`} onClick={() => setFilter('it_approved')}>Awaiting Director Approval</button>
            <button className={`tab ${filter === 'pending_it' ? 'active' : ''}`} onClick={() => setFilter('pending_it')}>Pending IT</button>
          </>
        ) : (
          <>
            <button className={`tab ${filter === 'pending_it' ? 'active' : ''}`} onClick={() => setFilter('pending_it')}>Pending IT Approval</button>
            <button className={`tab ${filter === 'it_approved' ? 'active' : ''}`} onClick={() => setFilter('it_approved')}>IT Approved</button>
            <button className={`tab ${filter === 'pending_director' ? 'active' : ''}`} onClick={() => setFilter('pending_director')}>Awaiting Director</button>
          </>
        )}
        <button className={`tab ${filter === 'director_approved' ? 'active' : ''}`} onClick={() => setFilter('director_approved')}>Approved</button>
        <button className={`tab ${filter === 'director_rejected' ? 'active' : ''}`} onClick={() => setFilter('director_rejected')}>Rejected</button>
        <button className={`tab ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>Cancelled</button>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Leave Requests</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="🌴" title="No leave requests in this category" />}
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr>
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
                  <td className="text-sm text-muted" style={{ maxWidth: 220 }}>{l.reason || '—'}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetail(l)}>Details</button>
                    {['pending_it', 'it_approved'].includes(l.status) && user.role === 'it' && l.status === 'pending_it' && (
                      <button className="btn btn-primary btn-sm" onClick={() => setDecisionModal({ id: l.id, decision: 'approved' })}>Approve</button>
                    )}
                    {l.status === 'it_approved' && user.role === 'director' && (
                      <button className="btn btn-primary btn-sm" onClick={() => setDecisionModal({ id: l.id, decision: 'approved' })}>Approve</button>
                    )}
                    {['pending_it', 'it_approved'].includes(l.status) && (
                      <button className="btn btn-danger btn-sm" onClick={() => setDecisionModal({ id: l.id, decision: 'rejected' })}>Reject</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Leave Details">
        {detail && (
          <div className="detail-stack">
            <div className="detail-item"><div className="k">Employee</div><div className="v">{detail.employeeName} ({detail.employeeCode})</div></div>
            <div className="detail-item"><div className="k">Type</div><div className="v">{LEAVE_TYPE_LABELS[detail.leaveType]}</div></div>
            <div className="detail-item"><div className="k">Dates</div><div className="v">{formatDate(detail.startDate)} → {formatDate(detail.endDate)}</div></div>
            <div className="detail-item"><div className="k">Days</div><div className="v">{Number(detail.days)}</div></div>
            <div className="detail-item"><div className="k">Reason</div><div className="v">{detail.reason || '—'}</div></div>
            <div className="detail-item"><div className="k">Comments</div><div className="v">{detail.comments || '—'}</div></div>
            <div className="detail-item"><div className="k">Status</div><div className="v"><StatusBadge status={detail.status} /></div></div>
            {detail.itReviewedByName && <div className="detail-item"><div className="k">IT Review</div><div className="v">{detail.itReviewedByName} · {detail.itRemarks || 'no remarks'}</div></div>}
            {detail.directorReviewedByName && <div className="detail-item"><div className="k">Director Review</div><div className="v">{detail.directorReviewedByName} · {detail.directorRemarks || 'no remarks'}</div></div>}
          </div>
        )}
      </Modal>

      <Modal open={!!decisionModal} onClose={() => setDecisionModal(null)} title={decisionModal?.decision === 'approved' ? 'Approve Leave' : 'Reject Leave'}>
        <p className="text-sm text-muted mb-16">
          {decisionModal?.decision === 'approved'
            ? `Approving leave request #${decisionModal?.id}. The worker will be notified.`
            : `Rejecting leave request #${decisionModal?.id}. The worker will be notified with the reason.`}
        </p>
        <div className="field">
          <label>Remarks</label>
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={decisionModal?.decision === 'rejected' ? 'Required reason' : 'Optional note'} />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setDecisionModal(null)}>Cancel</button>
          <button className={`btn ${decisionModal?.decision === 'approved' ? 'btn-success' : 'btn-danger'}`} disabled={loading || (decisionModal?.decision === 'rejected' && !remarks.trim())} onClick={review}>
            {loading ? 'Processing...' : `Confirm ${decisionModal?.decision === 'approved' ? 'Approval' : 'Rejection'}`}
          </button>
        </div>
      </Modal>
    </div>
  )
}