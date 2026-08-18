import { useEffect, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDateTime } from '../../utils/format.js'

export default function AdminEmails() {
  const toast = useToast()
  const [tab, setTab] = useState('logs')
  const [logs, setLogs] = useState(null)
  const [form, setForm] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (tab !== 'logs') return
    setLogs(null)
    api.get('/emails/logs', { limit: 200 }).then((res) => setLogs(res.data.rows)).catch(() => setLogs([]))
  }, [tab])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const send = async () => {
    setSubmitting(true)
    try {
      const res = await api.post('/emails/send', form)
      toast.success(res.message || 'Email sent')
      setForm({})
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const testSmtp = async () => {
    try {
      const res = await api.post('/emails/test')
      toast.success(res.message || 'Test email sent')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Emails</div>
          <div className="page-subtitle">Compose emails and review the email log</div>
        </div>
        <button className="btn btn-secondary" onClick={testSmtp}>Test SMTP</button>
      </div>

      <div className="tabs mb-16">
        <button className={`tab ${tab === 'compose' ? 'active' : ''}`} onClick={() => setTab('compose')}>Send Email</button>
        <button className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>Email Logs</button>
      </div>

      {tab === 'compose' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Compose Email</div></div>
          <div className="card-body">
            <div className="form-row">
              <Field field={{ name: 'to', label: 'Recipient Email', type: 'email', required: true }} value={form.to} onChange={set} />
              <Field field={{ name: 'subject', label: 'Subject', type: 'text', required: true }} value={form.subject} onChange={set} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'category', label: 'Category', type: 'select', options: ['offer_letter', 'joining_letter', 'appointment_letter', 'increment_letter', 'promotion_letter', 'leave_notification', 'salary_delay', 'salary_slip', 'meeting', 'document_verification', 'profile_rejection', 'profile_approval', 'credentials', 'other'] }} value={form.category} onChange={set} />
              <Field field={{ name: 'employeeId', label: 'Related Employee ID (optional)', type: 'text' }} value={form.employeeId} onChange={set} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'message', label: 'Message (HTML allowed)', type: 'textarea', rows: 6 }} value={form.message} onChange={set} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={submitting || !form.to || !form.subject} onClick={send}>
                {submitting ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Email Logs</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {logs && logs.length === 0 && <EmptyState icon="📧" title="No emails sent yet" />}
            {logs && (
              <table className="table">
                <thead>
                  <tr><th>Sent At</th><th>To</th><th>Subject</th><th>Category</th><th>Status</th><th>Error</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="text-sm">{formatDateTime(l.sentAt)}</td>
                      <td className="text-sm">{l.recipient}</td>
                      <td className="text-sm" style={{ maxWidth: 260 }}>{l.subject}</td>
                      <td className="text-sm">{l.category}</td>
                      <td><StatusBadge status={l.status} labels={{ sent: 'Sent', failed: 'Failed' }} /></td>
                      <td className="text-xs text-muted" style={{ maxWidth: 180 }}>{l.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}