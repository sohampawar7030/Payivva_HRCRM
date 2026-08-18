import { useEffect, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { formatDateTime } from '../../utils/format.js'
import { ROLE_LABELS } from '../../../../shared/constants.js'

export default function ItAccess() {
  const toast = useToast()
  const [rows, setRows] = useState(null)

  const load = () => {
    api.get('/settings/user-access').then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [])

  const update = async (u, patch) => {
    try {
      await api.put('/settings/user-access', { userId: u.id, ...patch })
      toast.success('User access updated')
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  if (!rows) return <LoadingPage label="Loading user access..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">User Access Management</div>
          <div className="page-subtitle">Manage HRCRM account status and roles</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">HRCRM Users</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="👤" title="No users yet" />}
          <table className="table">
            <thead>
              <tr><th>User</th><th>Employee</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name || u.email}</strong>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="text-sm">{u.employeeCode ? `${u.employeeName} (${u.employeeCode})` : '—'}</td>
                  <td>
                    <select className="select" style={{ width: 160 }} value={u.role} disabled={u.role === 'director'} onChange={(e) => update(u, { role: e.target.value })}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td><StatusBadge status={u.status} labels={{ pending_onboarding: 'Pending Onboarding', active: 'Active', disabled: 'Disabled' }} /></td>
                  <td className="text-sm">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                  <td>
                    {u.role !== 'director' && (
                      u.status === 'disabled'
                        ? <button className="btn btn-success btn-sm" onClick={() => update(u, { status: 'active' })}>Enable</button>
                        : <button className="btn btn-danger btn-sm" onClick={() => update(u, { status: 'disabled' })}>Disable</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}