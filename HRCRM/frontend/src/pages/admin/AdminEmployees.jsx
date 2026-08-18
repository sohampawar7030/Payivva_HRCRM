import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { formatDate } from '../../utils/format.js'

export default function AdminEmployees() {
  const [rows, setRows] = useState(null)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)

  const limit = 50

  const load = () => {
    setRows(null)
    api.get('/workers', { search, status: status || undefined, limit, offset: page * limit })
      .then((res) => { setRows(res.data.rows); setTotal(res.data.total) })
      .catch(() => setRows([]))
  }
  useEffect(load, [search, status, page])

  if (!rows) return <LoadingPage label="Loading employees..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">All Employees</div>
          <div className="page-subtitle">{total} employee(s)</div>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="input" placeholder="Search by name, ID, email or mobile..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} style={{ flex: 1 }} />
          <select className="input" style={{ width: 220 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
            <option value="">All statuses</option>
            <option value="not_started">Not Started</option>
            <option value="incomplete">Incomplete</option>
            <option value="submitted">Submitted</option>
            <option value="it_approved">IT Approved</option>
            <option value="it_rejected">IT Rejected</option>
            <option value="director_approved">Director Approved</option>
            <option value="director_rejected">Director Rejected</option>
            <option value="fully_verified">Fully Verified</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Employee List</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="👥" title="No employees found" />}
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Designation</th><th>Joined</th><th>Salary</th><th>Profile Status</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/admin/employees/${e.id}`} className="no-underline"><strong>{e.name}</strong></Link>
                    <div className="text-xs text-muted">{e.email || '—'}</div>
                  </td>
                  <td className="text-sm">{e.employee_id}</td>
                  <td className="text-sm">{e.department || '—'}</td>
                  <td className="text-sm">{e.designation || '—'}</td>
                  <td className="text-sm">{formatDate(e.joining_date)}</td>
                  <td className="text-sm">{e.salary ? `₹ ${Number(e.salary).toLocaleString('en-IN')}` : '—'}</td>
                  <td><StatusBadge status={e.profileStatus || 'not_started'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > limit && (
            <div className="pagination">
              <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Prev</button>
              <span className="text-sm text-muted">Page {page + 1} of {Math.ceil(total / limit)}</span>
              <button className="btn btn-ghost btn-sm" disabled={(page + 1) * limit >= total} onClick={() => setPage(page + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}