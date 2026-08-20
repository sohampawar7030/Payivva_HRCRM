import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDate } from '../../utils/format.js'

function generateEmployeeCodeFromName(name, existingWorkers = []) {
  if (!name || !name.trim()) return ''
  const parts = name.trim().split(/\s+/)
  const firstChar = (parts[0] || 'E')[0].toUpperCase()
  const lastChar = (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || parts[0][0] || 'M')).toUpperCase()
  const existingSet = new Set((existingWorkers || []).map((w) => (w.employee_id || w.employeeCode || '').toUpperCase()))

  let attempts = 0
  while (attempts < 100) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000)
    const code = `PAYIVVA_${firstChar}${lastChar}${randomDigits}`
    if (!existingSet.has(code.toUpperCase())) {
      return code
    }
    attempts++
  }
  return `PAYIVVA_${firstChar}${lastChar}${Math.floor(1000 + Math.random() * 9000)}`
}

export default function AdminEmployees() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [showRegister, setShowRegister] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reg, setReg] = useState({})
  const [created, setCreated] = useState(null)

  const limit = 50

  const load = () => {
    setRows(null)
    api.get('/workers', { search, status: status || undefined, limit, offset: page * limit })
      .then((res) => { setRows(res.data.rows); setTotal(res.data.total) })
      .catch(() => setRows([]))
  }
  useEffect(load, [search, status, page])

  const set = (k, v) => setReg((f) => ({ ...f, [k]: v }))

  const handleNameChange = (k, v) => {
    setReg((f) => {
      const next = { ...f, name: v }
      if (!f.manualEmployeeId) {
        next.employeeId = generateEmployeeCodeFromName(v, rows || [])
      }
      return next
    })
  }

  const handleEmployeeIdChange = (k, v) => {
    setReg((f) => ({ ...f, employeeId: v, manualEmployeeId: true }))
  }

  const triggerAutoGenerateId = () => {
    const code = generateEmployeeCodeFromName(reg.name || 'Worker', rows || [])
    setReg((f) => ({ ...f, employeeId: code, manualEmployeeId: false }))
  }

  const register = async () => {
    setSubmitting(true)
    try {
      const res = await api.post('/workers', reg)
      toast.success('Worker registered successfully')
      setCreated(res.data)
      setShowRegister(false)
      setReg({})
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!rows) return <LoadingPage label="Loading employees..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">All Employees</div>
          <div className="page-subtitle">{total} employee(s)</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setReg({}); setShowRegister(true); }}>+ Register Worker</button>
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

      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register New Worker" wide>
        <div className="form-row">
          <Field field={{ name: 'name', label: 'Full Name', type: 'text', required: true }} value={reg.name} onChange={handleNameChange} />
          <div style={{ flex: 1, position: 'relative' }}>
            <Field field={{ name: 'employeeId', label: 'Employee ID', type: 'text', required: true, hint: 'Auto-generated format (e.g. PAYIVVA_ST8492)' }} value={reg.employeeId} onChange={handleEmployeeIdChange} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={triggerAutoGenerateId}
              style={{ position: 'absolute', right: 0, top: 0, color: '#2563eb', fontSize: '11px', padding: '0 4px' }}
              title="Regenerate random 4-digit Employee ID"
            >
              ⚡ Auto Generate
            </button>
          </div>
        </div>
        <div className="form-row">
          <Field field={{ name: 'department', label: 'Department', type: 'text' }} value={reg.department} onChange={set} />
          <Field field={{ name: 'designation', label: 'Designation', type: 'text' }} value={reg.designation} onChange={set} />
          <Field field={{ name: 'joiningDate', label: 'Joining Date', type: 'date' }} value={reg.joiningDate} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'officialEmail', label: 'Official Email', type: 'email', required: true }} value={reg.officialEmail} onChange={set} />
          <Field field={{ name: 'personalEmail', label: 'Personal Email', type: 'email' }} value={reg.personalEmail} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'employmentType', label: 'Employment Type', type: 'select', options: ['Full Time', 'Part Time', 'Contract', 'Internship', 'Other'] }} value={reg.employmentType} onChange={set} />
          <Field field={{ name: 'reportingManager', label: 'Reporting Manager', type: 'text' }} value={reg.reportingManager} onChange={set} />
          <Field field={{ name: 'salary', label: 'Monthly Salary (₹)', type: 'number' }} value={reg.salary} onChange={set} />
          <Field field={{ name: 'wagePerHour', label: 'Wage / Hour (₹)', type: 'number' }} value={reg.wagePerHour} onChange={set} />
        </div>
        <div className="field">
          <label className="checkbox">
            <input type="checkbox" checked={reg.sendCredentials !== false} onChange={(e) => set('sendCredentials', e.target.checked)} />
            Send onboarding credentials via email
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setShowRegister(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={submitting || !reg.employeeId || !reg.name || !reg.officialEmail} onClick={register}>
            {submitting ? 'Registering...' : 'Register Worker'}
          </button>
        </div>
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Worker Registered">
        <div className="card-pad mb-16" style={{ background: 'var(--success-light)', borderRadius: 8 }}>
          <strong className="text-success">Onboarding link generated</strong>
        </div>
        {created && (
          <div>
            <p className="text-sm text-muted mb-16">Send this secure link to the worker to set their password and complete their profile. The link expires in 7 days.</p>
            <div className="card-pad" style={{ background: 'var(--gray-100)', borderRadius: 8, wordBreak: 'break-all' }}>
              <code className="text-sm">{created.onboardingLink}</code>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(created.onboardingLink); toast.success('Link copied') }}>Copy Link</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}