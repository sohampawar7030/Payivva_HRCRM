import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import { formatDate, timeAgo } from '../../utils/format.js'
import { DOCUMENT_TYPES } from '../../../../shared/constants.js'

export default function ItVerification() {
  const [tab, setTab] = useState('profiles')
  const [profiles, setProfiles] = useState(null)
  const [docs, setDocs] = useState(null)

  useEffect(() => {
    setProfiles(null)
    api.get('/workers', { status: 'submitted', limit: 200 }).then((res) => setProfiles(res.data.rows)).catch(() => setProfiles([]))
  }, [tab])

  useEffect(() => {
    setDocs(null)
    api.get('/documents', { status: 'pending', limit: 200 }).then((res) => setDocs(res.data.rows)).catch(() => setDocs([]))
  }, [tab])

  if (!profiles || !docs) return <LoadingPage label="Loading verification queue..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Verification Center</div>
          <div className="page-subtitle">Review submitted profiles and pending documents</div>
        </div>
      </div>

      <div className="tabs mb-16">
        <button className={`tab ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>
          Submitted Profiles ({profiles.length})
        </button>
        <button className={`tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>
          Pending Documents ({docs.length})
        </button>
      </div>

      {tab === 'profiles' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Profiles Awaiting IT Verification</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {profiles.length === 0 && <EmptyState icon="✅" title="No profiles awaiting verification" sub="Newly submitted profiles will appear here." />}
            <table className="table">
              <thead>
                <tr><th>Employee</th><th>Submitted</th><th>Documents</th><th></th></tr>
              </thead>
              <tbody>
                {profiles.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/it/workers/${e.id}`} className="no-underline"><strong>{e.name}</strong></Link>
                      <div className="text-xs text-muted">{e.employee_id}</div>
                    </td>
                    <td className="text-sm">{timeAgo(e.submittedAt)}</td>
                    <td className="text-sm">{e.documentsApproved}/{e.documentsCount} verified</td>
                    <td><Link to={`/it/workers/${e.id}`} className="btn btn-primary btn-sm">Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Documents Awaiting Verification</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {docs.length === 0 && <EmptyState icon="✅" title="No documents awaiting verification" />}
            <table className="table">
              <thead>
                <tr><th>Document</th><th>Employee</th><th>Uploaded</th><th></th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm"><strong>{DOCUMENT_TYPES[d.docType]?.label || d.docType}</strong> <span className="text-muted">· v{d.version}</span><div className="text-xs text-muted">{d.originalName}</div></td>
                    <td className="text-sm">{d.employeeName}</td>
                    <td className="text-sm">{formatDate(d.uploadedAt)}</td>
                    <td>
                      <Link to={`/it/workers/${d.employeeId}?tab=documents`} className="btn btn-primary btn-sm">Verify</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}