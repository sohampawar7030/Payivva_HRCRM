import { useEffect, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage } from '../../components/ui/Feedback.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDateTime } from '../../utils/format.js'
import { ROLE_LABELS } from '../../../../shared/constants.js'

const GENERAL_KEYS = [
  { key: 'attendanceTimezone', label: 'Attendance Timezone', hint: 'e.g. +05:30' },
  { key: 'monthlyWorkDays', label: 'Monthly Work Days', hint: 'Used for absent-day calculation' },
  { key: 'maxDocumentSizeMb', label: 'Max Document Size (MB)' },
]

export default function AdminSettings() {
  const toast = useToast()
  const [tab, setTab] = useState('company')
  const [settings, setSettings] = useState(null)
  const [company, setCompany] = useState({})
  const [smtp, setSmtp] = useState({})
  const [salaryConfig, setSalaryConfig] = useState({})
  const [general, setGeneral] = useState({})
  const [users, setUsers] = useState(null)
  const [sites, setSites] = useState(null)
  const [editingSite, setEditingSite] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('running')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/settings').then((res) => {
      setCompany(res.data.company || {})
      setSmtp(res.data.smtp || {})
      setSalaryConfig(res.data.salaryConfig || {})
      setSettings(res.data.settings || {})
    }).catch(() => {})
    api.get('/settings/user-access').then((res) => setUsers(res.data.rows)).catch(() => setUsers([]))
    api.get('/sites').then((res) => setSites(res.data.rows)).catch(() => setSites([]))
  }
  useEffect(load, [])

  if (!settings || !users || !sites) return <LoadingPage label="Loading settings..." />

  const save = async (path, payload) => {
    setSaving(true)
    try {
      const res = await api.put(path, payload)
      toast.success(res.message || 'Saved')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const updateUser = async (u, patch) => {
    try {
      await api.put('/settings/user-access', { userId: u.id, ...patch })
      toast.success('User access updated')
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  const openSiteEditor = (site) => {
    setSelectedStatus(site.status)
    setEditingSite(site)
  }

  const saveSiteStatus = async () => {
    if (!editingSite || selectedStatus === editingSite.status) {
      setEditingSite(null)
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/sites/${editingSite.id}/status`, { status: selectedStatus })
      toast.success(res.message || 'Site status updated')
      setEditingSite(null)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Company information, SMTP, salary rules and access control</div>
        </div>
      </div>

      <div className="tabs mb-16">
        <button className={`tab ${tab === 'company' ? 'active' : ''}`} onClick={() => setTab('company')}>Company</button>
        <button className={`tab ${tab === 'smtp' ? 'active' : ''}`} onClick={() => setTab('smtp')}>SMTP</button>
        <button className={`tab ${tab === 'sites' ? 'active' : ''}`} onClick={() => setTab('sites')}>Sites</button>
        <button className={`tab ${tab === 'salary' ? 'active' : ''}`} onClick={() => setTab('salary')}>Salary Rules</button>
        <button className={`tab ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>General</button>
        <button className={`tab ${tab === 'access' ? 'active' : ''}`} onClick={() => setTab('access')}>User Access</button>
      </div>

      {tab === 'company' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Company Information</div></div>
          <div className="card-body">
            <div className="form-row">
              <Field field={{ name: 'companyName', label: 'Company Name', type: 'text' }} value={company.companyName} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'currency', label: 'Currency Symbol', type: 'text' }} value={company.currency} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'address', label: 'Address', type: 'textarea' }} value={company.address} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'city', label: 'City', type: 'text' }} value={company.city} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'state', label: 'State', type: 'text' }} value={company.state} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'pincode', label: 'Pincode', type: 'text' }} value={company.pincode} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'contactPhone', label: 'Contact Phone', type: 'text' }} value={company.contactPhone} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'contactEmail', label: 'Contact Email', type: 'email' }} value={company.contactEmail} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'website', label: 'Website', type: 'text' }} value={company.website} onChange={(k, v) => setCompany((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={saving} onClick={() => save('/settings/company', company)}>{saving ? 'Saving...' : 'Save Company Info'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'smtp' && (
        <div className="card">
          <div className="card-header"><div className="card-title">SMTP Configuration</div></div>
          <div className="card-body">
            <div className="form-row">
              <Field field={{ name: 'host', label: 'SMTP Host', type: 'text' }} value={smtp.host} onChange={(k, v) => setSmtp((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'port', label: 'Port', type: 'number' }} value={smtp.port} onChange={(k, v) => setSmtp((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'username', label: 'Username / Email', type: 'text' }} value={smtp.username} onChange={(k, v) => setSmtp((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'password', label: 'Password (leave blank to keep current)', type: 'password' }} value={smtp.password === '••••••••' ? '' : smtp.password} onChange={(k, v) => setSmtp((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'fromName', label: 'From Name', type: 'text' }} value={smtp.fromName} onChange={(k, v) => setSmtp((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'fromEmail', label: 'From Email', type: 'email' }} value={smtp.fromEmail} onChange={(k, v) => setSmtp((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="field">
              <label className="checkbox">
                <input type="checkbox" checked={Boolean(smtp.secure)} onChange={(e) => setSmtp((f) => ({ ...f, secure: e.target.checked }))} />
                Use SSL/TLS
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={saving} onClick={() => save('/settings/smtp', smtp)}>{saving ? 'Saving...' : 'Save SMTP Settings'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'sites' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Site Status — Attendance Control</div>
            <div className="card-subtitle">Only Super Admin (Director) can change site status. Click "Edit Site" to set Running / Stopped / Hold.</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {sites.length === 0 && <div className="p-16 text-sm text-muted">No sites found.</div>}
            <table className="table">
              <thead>
                <tr><th>Site</th><th>Code</th><th>Location</th><th>Workers</th><th>Status</th><th>Changed By / At</th><th>Action</th></tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.site_name}</strong></td>
                    <td className="text-sm">{s.site_code}</td>
                    <td className="text-sm">{[s.city, s.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="text-sm">{s.workerCount || 0}</td>
                    <td>
                      {s.status === 'running'
                        ? <StatusBadge status="running" />
                        : s.status === 'stopped'
                          ? <StatusBadge status="stopped" />
                          : <StatusBadge status="on_hold" />}
                      {s.statusSource === 'legacy' && s.status !== 'running' && (
                        <div className="text-xs text-muted mt-8">From site system ({s.legacyStatus})</div>
                      )}
                    </td>
                    <td className="text-sm">
                      {s.changedAt
                        ? <>{s.changedByName || '—'}<div className="text-xs text-muted">{formatDateTime(s.changedAt)}</div></>
                        : 'Never changed'}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openSiteEditor(s)}>✏️ Edit Site</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editingSite)}
        onClose={() => !saving && setEditingSite(null)}
        title={editingSite ? `Edit Site: ${editingSite.site_name}` : 'Edit Site'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditingSite(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={saveSiteStatus} disabled={saving || selectedStatus === editingSite?.status}>
              {saving ? 'Saving...' : 'Save Status'}
            </button>
          </>
        }
      >
        {editingSite && (
          <div>
            <div className="text-sm" style={{ marginBottom: 12 }}>
              <strong>{editingSite.site_name}</strong>
              <div className="text-muted">{editingSite.site_code} · {[editingSite.city, editingSite.state].filter(Boolean).join(', ') || '—'} · {editingSite.workerCount || 0} workers</div>
            </div>

            <div className="badge-row mb-16" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${selectedStatus === 'running' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => setSelectedStatus('running')}
                style={{ flex: 1 }}
              >
                ▶ Running
              </button>
              <button
                type="button"
                className={`btn ${selectedStatus === 'stopped' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setSelectedStatus('stopped')}
                style={{ flex: 1 }}
              >
                ⏹ Stopped
              </button>
              <button
                type="button"
                className={`btn ${selectedStatus === 'on_hold' ? 'btn-warning' : 'btn-secondary'}`}
                onClick={() => setSelectedStatus('on_hold')}
                style={{ flex: 1 }}
              >
                ⏸ Hold
              </button>
            </div>

            <div className="text-sm text-muted" style={{ marginBottom: 12 }}>
              Current status:{' '}
              {editingSite.status === 'running'
                ? <StatusBadge status="running" />
                : editingSite.status === 'stopped'
                  ? <StatusBadge status="stopped" />
                  : <StatusBadge status="on_hold" />}
            </div>

            {(selectedStatus === 'on_hold' || selectedStatus === 'stopped') && (
              <div className="alert alert-warning">
                ⚠️ <strong>Warning:</strong> Agar aap is site ko {selectedStatus === 'stopped' ? 'Stopped' : 'Hold'} karte hain to
                is site ke saare workers ki <strong>attendance ruk jayegi (Hold)</strong> aur unhe{" "}
                <strong>absent nahi maana jayega</strong>. Attendance tab tak band rahegi jab tak
                Super Admin (Director) ise wapas <strong>Running</strong> nahi karta. Ye action{" "}
                <strong>sirf Super Admin (Director)</strong> kar sakta hai.
              </div>
            )}
            {selectedStatus === 'running' && (
              <div className="alert alert-success">
                ▶ <strong>Running:</strong> Is site ke workers ki attendance normal chalegi.
                Ye action sirf Super Admin (Director) kar sakta hai.
              </div>
            )}
          </div>
        )}
      </Modal>

      {tab === 'salary' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Salary Calculation Rules</div></div>
          <div className="card-body">
            <div className="form-row">
              <Field field={{ name: 'monthlyWorkDays', label: 'Work Days / Month', type: 'number' }} value={salaryConfig.monthlyWorkDays} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'basicPercent', label: 'Basic %', type: 'number' }} value={salaryConfig.basicPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'hraPercent', label: 'HRA %', type: 'number' }} value={salaryConfig.hraPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'daPercent', label: 'DA %', type: 'number' }} value={salaryConfig.daPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'absentDeductionPercent', label: 'Absent Deduction %', type: 'number' }} value={salaryConfig.absentDeductionPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'halfDayDeductionPercent', label: 'Half-Day Deduction %', type: 'number' }} value={salaryConfig.halfDayDeductionPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'pfPercent', label: 'PF %', type: 'number' }} value={salaryConfig.pfPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'esicPercent', label: 'ESIC %', type: 'number' }} value={salaryConfig.esicPercent} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'professionalTaxAmount', label: 'Professional Tax (₹)', type: 'number' }} value={salaryConfig.professionalTaxAmount} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'lateDeductionAmount', label: 'Late Deduction (₹/day)', type: 'number' }} value={salaryConfig.lateDeductionAmount} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
              <Field field={{ name: 'overtimeRatePerHour', label: 'Overtime Rate (₹/hr)', type: 'number' }} value={salaryConfig.overtimeRatePerHour} onChange={(k, v) => setSalaryConfig((f) => ({ ...f, [k]: v }))} />
            </div>
            <div className="form-row">
              <div className="field"><label className="checkbox"><input type="checkbox" checked={salaryConfig.includePf === 'true'} onChange={(e) => setSalaryConfig((f) => ({ ...f, includePf: String(e.target.checked) }))} /> Include PF</label></div>
              <div className="field"><label className="checkbox"><input type="checkbox" checked={salaryConfig.includeEsic === 'true'} onChange={(e) => setSalaryConfig((f) => ({ ...f, includeEsic: String(e.target.checked) }))} /> Include ESIC</label></div>
              <div className="field"><label className="checkbox"><input type="checkbox" checked={salaryConfig.allowOvertime === 'true'} onChange={(e) => setSalaryConfig((f) => ({ ...f, allowOvertime: String(e.target.checked) }))} /> Allow Overtime</label></div>
              <div className="field"><label className="checkbox"><input type="checkbox" checked={salaryConfig.allowLateDeduction === 'true'} onChange={(e) => setSalaryConfig((f) => ({ ...f, allowLateDeduction: String(e.target.checked) }))} /> Late Deductions</label></div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={saving} onClick={() => save('/settings/salary-config', salaryConfig)}>{saving ? 'Saving...' : 'Save Salary Rules'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'general' && (
        <div className="card">
          <div className="card-header"><div className="card-title">General Settings</div></div>
          <div className="card-body">
            <div className="form-row">
              {GENERAL_KEYS.map((g) => (
                <Field key={g.key} field={{ name: g.key, label: g.label, type: 'text', hint: g.hint }} value={general[g.key] !== undefined ? general[g.key] : settings[g.key]} onChange={(k, v) => setGeneral((f) => ({ ...f, [k]: v }))} />
              ))}
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={saving || Object.keys(general).length === 0} onClick={() => save('/settings', general)}>{saving ? 'Saving...' : 'Save General Settings'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'access' && (
        <div className="card">
          <div className="card-header"><div className="card-title">User Access</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>User</th><th>Employee</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name || u.email}</strong><div className="text-xs text-muted">{u.email}</div></td>
                    <td className="text-sm">{u.employeeCode ? `${u.employeeName} (${u.employeeCode})` : '—'}</td>
                    <td>
                      <select className="select" style={{ width: 160 }} value={u.role} disabled={u.role === 'director'} onChange={(e) => updateUser(u, { role: e.target.value })}>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td><StatusBadge status={u.status} labels={{ pending_onboarding: 'Pending Onboarding', active: 'Active', disabled: 'Disabled' }} /></td>
                    <td className="text-sm">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                    <td>
                      {u.role !== 'director' && (
                        u.status === 'disabled'
                          ? <button className="btn btn-success btn-sm" onClick={() => updateUser(u, { status: 'active' })}>Enable</button>
                          : <button className="btn btn-danger btn-sm" onClick={() => updateUser(u, { status: 'disabled' })}>Disable</button>
                      )}
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