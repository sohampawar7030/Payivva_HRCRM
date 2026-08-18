import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx'
import { formatDate, formatDateTime, maskSensitive } from '../../utils/format.js'
import { openFile } from '../../utils/files.js'
import { DOCUMENT_TYPES } from '../../../../shared/constants.js'

export default function ItWorkerDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [docModal, setDocModal] = useState(null)
  const [verifyModal, setVerifyModal] = useState(null)
  const [reopenModal, setReopenModal] = useState(false)
  const [docDecision, setDocDecision] = useState('approved')
  const [docRemarks, setDocRemarks] = useState('')
  const [remarks, setRemarks] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)

  const load = () => {
    api.get(`/workers/${id}`).then((res) => setProfile(res.data)).catch(() => setProfile(null))
    api.get(`/workers/${id}/verification-history`).then((res) => setHistory(res.data.rows)).catch(() => setHistory([]))
  }
  useEffect(load, [id])

  if (!profile) return <LoadingPage label="Loading employee..." />

  const { employee, personal, contact, education, employment, skills, verification, documents, assets, user: account, profileCompletion } = profile
  const status = verification?.profileStatus || 'not_started'

  const verifyProfile = async (decision) => {
    setLoadingAction(true)
    try {
      await api.post(`/workers/${id}/verify`, { level: 'it', decision, remarks })
      toast.success(`Profile ${decision}`)
      setVerifyModal(null)
      setRemarks('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoadingAction(false)
    }
  }

  const reopenProfile = async () => {
    setLoadingAction(true)
    try {
      await api.post(`/workers/${id}/reopen`)
      toast.success('Profile reopened for editing')
      setReopenModal(false)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoadingAction(false)
    }
  }

  const verifyDoc = async () => {
    setLoadingAction(true)
    try {
      await api.put(`/documents/${docModal.id}/verify`, { decision: docDecision, remarks: docRemarks })
      toast.success(`Document ${docDecision}`)
      setDocModal(null)
      setDocDecision('approved')
      setDocRemarks('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoadingAction(false)
    }
  }

  const openDoc = (docId) => openFile(`/documents/${docId}/download`)

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/it/workers" className="text-sm text-muted">← Back to Employees</Link>
          <div className="page-title">{employee.name}</div>
          <div className="page-subtitle">{employee.employee_id} · {employee.department || '—'} · {employee.designation || '—'}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-4 mb-16">
        <div className="card card-pad"><div className="text-sm text-muted">Profile Completion</div><div className="font-bold" style={{ fontSize: 22 }}>{profileCompletion.percent}%</div></div>
        <div className="card card-pad"><div className="text-sm text-muted">Documents Verified</div><div className="font-bold" style={{ fontSize: 22 }}>{documents.filter((d) => d.verificationStatus === 'approved').length}/{documents.length}</div></div>
        <div className="card card-pad"><div className="text-sm text-muted">Account Status</div><div className="font-bold" style={{ fontSize: 22 }}>{account?.status || 'No account'}</div></div>
        <div className="card card-pad"><div className="text-sm text-muted">Joined</div><div className="font-bold" style={{ fontSize: 22 }}>{formatDate(employee.joining_date)}</div></div>
      </div>

      {status === 'submitted' && (
        <div className="card-pad mb-16" style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <strong className="text-warning">Profile awaiting IT verification</strong>
            <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>Review all sections and documents before approving.</div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-danger" onClick={() => setVerifyModal('rejected')}>Reject</button>
            <button className="btn btn-success" onClick={() => setVerifyModal('approved')}>Approve</button>
          </div>
        </div>
      )}
      {['it_rejected', 'director_rejected', 'fully_verified', 'director_approved'].includes(status) && (
        <div className="card-pad mb-16" style={{ background: 'var(--gray-100)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="text-sm">Profile status: <strong>{status}</strong>{verification?.itRemarks && ` · IT remark: ${verification.itRemarks}`}{verification?.directorRemarks && ` · Director remark: ${verification.directorRemarks}`}</div>
          {user.role === 'director' && <button className="btn btn-secondary btn-sm" onClick={() => setReopenModal(true)}>Reopen for Editing</button>}
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab ${activeTab === 'sections' ? 'active' : ''}`} onClick={() => setActiveTab('sections')}>Profile Sections</button>
        <button className={`tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents ({documents.length})</button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Verification History</button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header"><div className="card-title">Personal Details</div></div>
            <div className="card-body">
              <div className="detail-stack">
                <div className="detail-item"><div className="k">Father's Name</div><div className="v">{personal?.fatherName || '—'}</div></div>
                <div className="detail-item"><div className="k">Mother's Name</div><div className="v">{personal?.motherName || '—'}</div></div>
                <div className="detail-item"><div className="k">Date of Birth</div><div className="v">{formatDate(personal?.dateOfBirth || employee.dob)}</div></div>
                <div className="detail-item"><div className="k">Gender</div><div className="v">{personal?.gender || employee.gender || '—'}</div></div>
                <div className="detail-item"><div className="k">Blood Group</div><div className="v">{personal?.bloodGroup || '—'}</div></div>
                <div className="detail-item"><div className="k">Marital Status</div><div className="v">{personal?.maritalStatus || '—'}</div></div>
                <div className="detail-item"><div className="k">Nationality</div><div className="v">{personal?.nationality || '—'}</div></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Contact & Bank</div></div>
            <div className="card-body">
              <div className="detail-stack">
                <div className="detail-item"><div className="k">Mobile</div><div className="v">{contact?.mobileNumber || employee.mobile || '—'}</div></div>
                <div className="detail-item"><div className="k">Official Email</div><div className="v">{contact?.officialEmail || employee.email || '—'}</div></div>
                <div className="detail-item"><div className="k">Emergency Contact</div><div className="v">{contact?.emergencyContactName || '—'} ({contact?.emergencyRelation || '—'}) {contact?.emergencyContactNumber || ''}</div></div>
                <div className="detail-item"><div className="k">Bank</div><div className="v">{employment?.bankName || '—'} · {maskSensitive(employment?.accountNumber)}</div></div>
                <div className="detail-item"><div className="k">IFSC</div><div className="v">{maskSensitive(employment?.ifscCode)}</div></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Skills</div></div>
            <div className="card-body">
              {skills?.length ? (
                <div className="chip-row">{skills.map((s, i) => <span key={i} className="chip">{s.skill}</span>)}</div>
              ) : '—'}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Company Assets</div></div>
            <div className="card-body">
              {assets?.length ? (
                <table className="summary-table">
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id}><td>{a.component}</td><td>{a.quantity || 1}</td><td>{formatDate(a.issued_date)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : '—'}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="stack">
          <div className="card">
            <div className="card-header"><div className="card-title">Employment Details</div></div>
            <div className="card-body">
              <div className="detail-stack">
                <div className="detail-item"><div className="k">Previous Company</div><div className="v">{employment?.previousCompany || '—'}</div></div>
                <div className="detail-item"><div className="k">Experience</div><div className="v">{employment?.experienceYears ? `${employment.experienceYears} years` : '—'}</div></div>
                <div className="detail-item"><div className="k">Last Salary</div><div className="v">{employment?.lastSalary ? `₹ ${Number(employment.lastSalary).toLocaleString('en-IN')}` : '—'}</div></div>
                <div className="detail-item"><div className="k">Reason for Leaving</div><div className="v">{employment?.reasonForLeaving || '—'}</div></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Education</div></div>
            <div className="card-body" style={{ padding: 0 }}>
              {education?.length ? (
                <table className="table">
                  <thead><tr><th>Qualification</th><th>Institute</th><th>Year</th><th>% / CGPA</th></tr></thead>
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
            <div className="card-header"><div className="card-title">Assets in Inventory System</div></div>
            <div className="card-body" style={{ padding: 0 }}>
              {assets?.length ? (
                <table className="table">
                  <thead><tr><th>Component</th><th>Qty</th><th>Issued</th><th>Notes</th></tr></thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id}><td>{a.component}</td><td>{a.quantity || 1}</td><td>{formatDate(a.issued_date)}</td><td className="text-sm text-muted">{a.notes || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-16 text-sm text-muted">No assets issued.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="stack">
          {documents.length === 0 && <div className="card"><EmptyState icon="📁" title="No documents uploaded yet" /></div>}
          {documents.map((d) => (
            <div key={d.id} className="card card-pad flex items-center justify-between">
              <div>
                <strong className="text-sm">{DOCUMENT_TYPES[d.docType]?.label || d.docType} <span className="text-muted">· v{d.version}</span></strong>
                <div className="text-xs text-muted mt-4">{d.originalName} · {formatDateTime(d.uploadedAt)}</div>
                {d.rejectionReason && <div className="text-xs text-danger mt-4">Rejected: {d.rejectionReason}</div>}
                {d.remarks && <div className="text-xs text-muted mt-4">Remarks: {d.remarks}</div>}
              </div>
              <div className="flex items-center gap-8">
                <StatusBadge status={d.verificationStatus} />
                <button className="btn btn-secondary btn-sm" onClick={() => openDoc(d.id)}>View</button>
                {d.verificationStatus === 'pending' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setDocModal(d)}>Verify</button>
                )}
              </div>
            </div>
          ))}
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

      <ConfirmDialog
        open={verifyModal === 'approved'}
        title="Approve this profile?"
        message="Approving at IT level sends the profile to the Director for final verification. Only approve if all information and documents are correct."
        confirmLabel="Approve Profile"
        onConfirm={() => verifyProfile('approved')}
        onCancel={() => setVerifyModal(null)}
        loading={loadingAction}
      />

      <Modal open={verifyModal === 'rejected'} onClose={() => setVerifyModal(null)} title="Reject Profile">
        <div className="field">
          <label>Reason for rejection (sent to the worker)</label>
          <textarea className="input" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Aadhaar number does not match the uploaded document" />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setVerifyModal(null)}>Cancel</button>
          <button className="btn btn-danger" disabled={loadingAction || !remarks.trim()} onClick={() => verifyProfile('rejected')}>
            {loadingAction ? 'Rejecting...' : 'Reject Profile'}
          </button>
        </div>
      </Modal>

      <Modal open={!!docModal} onClose={() => setDocModal(null)} title="Verify Document">
        {docModal && (
          <div>
            <div className="card-pad mb-16" style={{ background: 'var(--gray-100)', borderRadius: 8 }}>
              <div className="text-sm"><strong>{DOCUMENT_TYPES[docModal.docType]?.label || docModal.docType}</strong> · v{docModal.version}</div>
              <div className="text-xs text-muted mt-4">{docModal.originalName}</div>
              <button className="btn btn-secondary btn-sm mt-8" onClick={() => openDoc(docModal.id)}>Open Document</button>
            </div>
            <div className="role-select mb-16" style={{ maxWidth: 320 }}>
              <button type="button" className={`role-option ${docDecision === 'approved' ? 'selected' : ''}`} onClick={() => setDocDecision('approved')}>Approve</button>
              <button type="button" className={`role-option ${docDecision === 'rejected' ? 'selected' : ''}`} onClick={() => setDocDecision('rejected')}>Reject</button>
            </div>
            {docDecision === 'rejected' && (
              <div className="field">
                <label>Rejection reason</label>
                <textarea className="input" rows={3} value={docRemarks} onChange={(e) => setDocRemarks(e.target.value)} placeholder="e.g. Document is blurry, please re-upload" />
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setDocModal(null)}>Cancel</button>
              <button className={`btn ${docDecision === 'approved' ? 'btn-success' : 'btn-danger'}`} disabled={loadingAction || (docDecision === 'rejected' && !docRemarks.trim())} onClick={verifyDoc}>
                {loadingAction ? 'Saving...' : `Confirm ${docDecision === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={reopenModal}
        title="Reopen profile for editing?"
        message="The worker will be able to edit their profile again and must resubmit for verification."
        confirmLabel="Reopen Profile"
        onConfirm={reopenProfile}
        onCancel={() => setReopenModal(false)}
        loading={loadingAction}
      />
    </div>
  )
}