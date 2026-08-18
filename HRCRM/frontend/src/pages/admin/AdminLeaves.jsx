import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { formatDate } from '../../utils/format.js'
import { LEAVE_TYPE_LABELS } from '../../../../shared/constants.js'

export default function AdminLeaves() {
  const toast = useToast()
  const [filter, setFilter] = useState('pending_director')
  const [rows, setRows] = useState(null)
  const [detail, setDetail] = useState(null)
  const [decisionModal, setDecisionModal] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    setRows(null)
    api.get('/leaves', { status: filter, limit: 200 }).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [filter])

  const review = async () => {
    setLoading(true)
    try {
      await api.put(`/leaves/${decisionModal.id}/review`, { level: 'director', decision: decisionModal.decision, remarks })
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
          <div className="page-subtitle">Director level approval of leave requests</div>
        </div>
      </div>

      <div className="tabs mb-16">
        <button className={`tab ${filter === 'pending_director' ? 'active' : ''}`} onClick={() => setFilter('pending_director')}>Awaiting Approval</button>
        <button className={`tab ${filter === 'pending_it' ? 'active' : ''}`} onClick={() => setFilter('pending_it')}>Pending IT</button>
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
                    <Link to={`/admin/employees/${l.employeeId}`} className="no-underline"><strong>{l.employeeName}</strong></Link>
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
                    {l.status === 'pending_director' && (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => setDecisionModal({ id: l.id, decision: 'rejected' })}>Reject</button>
                        <button className="btn btn-success btn-sm" onClick={() => setDecisionModal({ id: l.id, decision: 'approved' })}>Approve</button>
                      </>
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
            {detail.itReviewedByName && <div className="detail-item"><div className="k">IT Review</div><div className="v">{detail.itReviewedByName} · {detail.itRemarks || 'no remarks'}</div></div>}
          </div>
        )}
      </Modal>

      <Modal open={!!decisionModal} onClose={() => setDecisionModal(null)} title={decisionModal?.decision === 'approved' ? 'Approve Leave' : 'Reject Leave'}>
        <div className="field">
          <label>Remarks {decisionModal?.decision === 'rejected' ? '(required)' : '(optional)'}</label>
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for your decision" />
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