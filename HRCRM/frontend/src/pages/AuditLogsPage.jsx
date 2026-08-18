import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { LoadingPage, EmptyState } from '../components/ui/Feedback.jsx'
import { formatDateTime } from '../utils/format.js'

const MODULE_LABELS = {
  worker_registration: 'Worker Registration',
  profile: 'Profile',
  document: 'Document',
  leave: 'Leave',
  payroll: 'Payroll',
  letter: 'Letter',
  email: 'Email',
  salary_delay: 'Salary Delay',
  meeting: 'Meeting',
  settings: 'Settings',
  user_access: 'User Access',
  auth: 'Authentication',
  attendance: 'Attendance',
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/audit-logs', { limit: 300, module: filter || undefined })
      .then((res) => setRows(res.data.rows))
      .catch(() => setRows([]))
  }, [filter])

  if (!rows) return <LoadingPage label="Loading audit logs..." />

  const modules = [...new Set(rows.map((r) => r.module))]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Logs</div>
          <div className="page-subtitle">Complete activity trail of the HRCRM system (Director only)</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 260 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{MODULE_LABELS[m] || m}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Activity Log</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="🕘" title="No activity recorded" />}
          <table className="table">
            <thead>
              <tr><th>When</th><th>Module</th><th>Action</th><th>Actor</th><th>Description</th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="text-sm">{formatDateTime(l.createdAt)}</td>
                  <td><span className="badge badge-blue">{MODULE_LABELS[l.module] || l.module}</span></td>
                  <td className="text-sm"><code>{l.action}</code></td>
                  <td className="text-sm">{l.actorName || 'System'}</td>
                  <td className="text-sm text-muted" style={{ maxWidth: 320 }}>{l.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}