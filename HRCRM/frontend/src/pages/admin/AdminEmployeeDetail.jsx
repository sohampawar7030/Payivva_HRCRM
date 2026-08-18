import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx'
import { formatDate, formatDateTime } from '../../utils/format.js'
import { openFile } from '../../utils/files.js'
import { DOCUMENT_TYPES, LEAVE_TYPE_LABELS } from '../../../../shared/constants.js'

export default function AdminEmployeeDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState(null)
  const [leaves, setLeaves] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [verifyModal, setVerifyModal] = useState(null)
  const [reopenModal, setReopenModal] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    api.get(`/workers/${id}`).then((res) => setProfile(res.data)).catch(() => setProfile(null))
    api.get(`/workers/${id}/verification-history`).then((res) => setHistory(res.data.rows)).catch(() => setHistory([]))
    api.get('/leaves', { employeeId: id, limit: 50 }).then((res) => setLeaves(res.data.rows)).catch(() => setLeaves([]))
  }
  useEffect(load, [id])

  if (!profile) return <LoadingPage label="Loading employee..." />

  const { employee, personal, contact, education, employment, skills, verification, documents, assets, profileCompletion } = profile
  const status = verification?.profileStatus || 'not_started'

  const verify = async () => {
    setLoading(true)
    try {
      await api.post(`/workers/${id}/verify`, { level: 'director', decision: verifyModal, remarks })
      toast.success(`Profile ${verifyModal} at Director level`)
      setVerifyModal(null)
      setRemarks('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const reopen = async () => {
    setLoading(true)
    try {
      await api.post(`/workers/${id}/reopen`)
      toast.success('Profile reopened')
      setReopenModal(false)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const openDoc = (docId) => openFile(`/documents/${docId}/download`)

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/admin/employees" className="text-sm text-muted">← Back to Employees</Link>
          <div className="page-title">{employee.name}</div>
          <div className="page-subtitle">{employee.employee_id} · {employee.department || '—'} · {employee.designation || '—'}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-4 mb-16">
        <div className="card card-pad"><div className="text-sm text-muted">Profile Completion</div><div className="font-bold" style={{ fontSize: 22 }}>{profileCompletion.percent}%</div></div>
        <div className="card card-pad"><div className="text-sm text-muted">Monthly Salary</div><div className="font-bold" style={{ fontSize: 22 }}>{employee.salary ? `₹ ${Number(employee.salary).toLocaleString('en-IN')}` : '—'}</div></div>
        <div className="card card-pad"><div className="text-sm text-muted">Joined</div><div className="font-bold" style={{ fontSize: 22 }}>{formatDate(employee.joining_date)}</div></div>
        <div className="card card-pad"><div className="text-sm text-muted">Status</div><div className="font-bold" style={{ fontSize: 22 }}>{employee.emp_status}</div></div>
      </div>

      {status === 'it_approved' && (
        <div className="card-pad mb-16" style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <strong className="text-warning">Profile approved by IT — awaiting Director approval</strong>
            {verification.itRemarks && <div className="text-sm mt-8">IT remark: {verification.itRemarks}</div>}
          </div>
          <div className="flex gap-8">
            <button className="btn btn-danger" onClick={() => setVerifyModal('rejected')}>Reject</button>
            <button className="btn btn-success" onClick={() => setVerifyModal('approved')}>Final Approve</button>
          </div>
        </div>
      )}
      {['fully_verified', 'director_rejected', 'it_rejected', 'director_approved'].includes(status) && (
        <div className="card-pad mb-16" style={{ background: 'var(--gray-100)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="text-sm">
            Profile status: <strong>{status}</strong>
            {verification?.itRemarks && ` · IT: ${verification.itRemarks}`}
            {verification?.directorRemarks && ` · Director: ${verification.directorRemarks}`}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setReopenModal(true)}>Reopen for Editing</button>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents ({documents.length})</button>
        <button className={`tab ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>Leave ({leaves?.length || 0})</button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Verification History</button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">Personal & Contact</div></div>
            <div className="card-body">
              <div className="detail-stack">
                <div className="detail-item"><div className="k">Father's Name</div><div className="v">{personal?.fatherName || '—'}</div></div>
                <div className="detail-item"><div className="k">Date of Birth</div><div className="v">{formatDate(personal?.dateOfBirth || employee.dob)}</div></div>
                <div className="detail-item"><div className="k">Gender</div><div className="v">{personal?.gender || employee.gender || '—'}</div></div>
                <div className="detail-item"><div className="k">Blood Group</div><div className="v">{personal?.bloodGroup || '—'}</div></div>
                <div className="detail-item"><div className="k">Mobile</div><div className="v">{contact?.mobileNumber || employee.mobile || '—'}</div></div>
                <div className="detail-item"><div className="k">Email</div><div className="v">{contact?.officialEmail || employee.email || '—'}</div></div>
                <div className="detail-item"><div className="k">Current Address</div><div className="v">{contact?.currentAddress || employee.current_address || '—'}</div></div>
                <div className="detail-item"><div className="k">Emergency Contact</div><div className="v">{contact?.emergencyContactName || employee.emergency_contact_name || '—'} · {contact?.emergencyContactNumber || employee.emergency_mobile || '—'}</div></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Employment & Bank</div></div>
            <div className="card-body">
              <div className="detail-stack">
                <div className="detail-item"><div className="k">Previous Company</div><div className="v">{employment?.previousCompany || '—'}</div></div>
                <div className="detail-item"><div className="k">Experience</div><div className="v">{employment?.experienceYears ? `${employment.experienceYears} years` : '—'}</div></div>
                <div className="detail-item"><div className="k">Bank</div><div className="v">{employment?.bankName || '—'} · A/c {employment?.accountNumber || '—'}</div></div>
                <div className="detail-item"><div className="k">IFSC</div><div className="v">{employment?.ifscCode || '—'}</div></div>
                <div className="detail-item"><div className="k">UPI</div><div className="v">{employment?.upiId || '—'}</div></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Education</div></div>
            <div className="card-body" style={{ padding: 0 }}>
              {education?.length ? (
                <table className="table">
                  <thead><tr><th>Qualification</th><th>Institute</th><th>Year</th><th>%</th></tr></thead>
                  <tbody>
                    {education.map((e, i) => (
                      <tr key={i}><td>{e.qualification}</td><td>{e.institute || '—'}</td><td>{e.year || '—'}</td><td>{e.percentage || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-16 text-sm text-muted">No education records.</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Skills & Assets</div></div>
            <div className="card-body">
              {skills?.length ? <div className="chip-row mb-16">{skills.map((s, i) => <span key={i} className="chip">{s.skill}</span>)}</div> : <div className="text-sm text-muted mb-16">No skills recorded.</div>}
              {assets?.length ? (
                <div>
                  <div className="text-sm font-semibold mb-8">Assets Issued</div>
                  {assets.map((a) => (
                    <div key={a.id} className="text-sm">{a.component} <span className="text-muted">· {a.quantity || 1} · {formatDate(a.issued_date)}</span></div>
                  ))}
                </div>
              ) : <div className="text-sm text-muted">No assets issued.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="stack">
          {documents.length === 0 && <div className="card"><EmptyState icon="📁" title="No documents uploaded" /></div>}
          {documents.map((d) => (
            <div key={d.id} className="card card-pad flex items-center justify-between">
              <div>
                <strong className="text-sm">{DOCUMENT_TYPES[d.docType]?.label || d.docType} <span className="text-muted">· v{d.version}</span></strong>
                <div className="text-xs text-muted mt-4">{d.originalName} · {formatDateTime(d.uploadedAt)}</div>
                {d.rejectionReason && <div className="text-xs text-danger mt-4">Rejected: {d.rejectionReason}</div>}
              </div>
              <div className="flex items-center gap-8">
                <StatusBadge status={d.verificationStatus} />
                <button className="btn btn-secondary btn-sm" onClick={() => openDoc(d.id)}>View</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Leave Requests</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {leaves.length === 0 && <EmptyState icon="🌴" title="No leave requests" />}
            <table className="table">
              <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td className="text-sm">{LEAVE_TYPE_LABELS[l.leaveType]}</td>
                    <td className="text-sm">{formatDate(l.startDate)}</td>
                    <td className="text-sm">{formatDate(l.endDate)}</td>
                    <td>{Number(l.days)}</td>
                    <td className="text-sm text-muted" style={{ maxWidth: 220 }}>{l.reason || '—'}</td>
                    <td><StatusBadge status={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Verification History</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {history.length === 0 && <EmptyState icon="🕘" title="No verification activity yet" />}
            <table className="table">
              <thead><tr><th>When</th><th>Action</th><th>Level</th><th>Actor</th><th>Remarks</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDateTime(h.createdAt)}</td>
                    <td><StatusBadge status={h.action} /></td>
                    <td>{h.level || '—'}</td>
                    <td>{h.actorName || '—'}</td>
                    <td className="text-sm text-muted">{h.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={verifyModal === 'approved'} onClose={() => setVerifyModal(null)} title="Final Approval">
        <p className="text-sm text-muted mb-16">This marks the employee as <strong>fully verified</strong>. All sections and documents have already been checked by IT.</p>
        <div className="field">
          <label>Remarks (optional)</label>
          <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setVerifyModal(null)}>Cancel</button>
          <button className="btn btn-success" disabled={loading} onClick={verify}>{loading ? 'Approving...' : 'Confirm Final Approval'}</button>
        </div>
      </Modal>

      <Modal open={verifyModal === 'rejected'} onClose={() => setVerifyModal(null)} title="Reject Profile">
        <p className="text-sm text-muted mb-16">The worker will be notified with your reason and must correct their profile.</p>
        <div className="field">
          <label>Reason (required)</label>
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Identity documents could not be verified" />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setVerifyModal(null)}>Cancel</button>
          <button className="btn btn-danger" disabled={loading || !remarks.trim()} onClick={verify}>{loading ? 'Rejecting...' : 'Reject Profile'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={reopenModal}
        title="Reopen profile for editing?"
        message="The worker will be able to edit their profile again and must resubmit for verification."
        confirmLabel="Reopen Profile"
        onConfirm={reopen}
        onCancel={() => setReopenModal(false)}
        loading={loading}
      />
    </div>
  )
}