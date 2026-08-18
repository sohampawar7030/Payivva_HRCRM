import { useEffect, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDateTime } from '../../utils/format.js'

export default function ItEmails() {
  const toast = useToast()
  const [tab, setTab] = useState('compose')
  const [logs, setLogs] = useState(null)
  const [form, setForm] = useState({})
  const [delayForm, setDelayForm] = useState({})
  const [meetingForm, setMeetingForm] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (tab !== 'logs') return
    setLogs(null)
    api.get('/emails/logs', { limit: 200 }).then((res) => setLogs(res.data.rows)).catch(() => setLogs([]))
  }, [tab])

  const set = (target) => (k, v) => target((f) => ({ ...f, [k]: v }))

  const sendCompose = async () => {
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

  const sendDelay = async () => {
    setSubmitting(true)
    try {
      const res = await api.post('/emails/salary-delay', delayForm)
      toast.success(res.message || 'Salary delay notifications sent')
      setDelayForm({})
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const sendMeeting = async () => {
    setSubmitting(true)
    try {
      const res = await api.post('/emails/meeting', meetingForm)
      toast.success(res.message || 'Meeting invitation sent')
      setMeetingForm({})
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
          <div className="page-subtitle">Send emails to employees and review email logs</div>
        </div>
        <button className="btn btn-secondary" onClick={testSmtp}>Test SMTP</button>
      </div>

      <div className="tabs mb-16">
        <button className={`tab ${tab === 'compose' ? 'active' : ''}`} onClick={() => setTab('compose')}>Send Email</button>
        <button className={`tab ${tab === 'delay' ? 'active' : ''}`} onClick={() => setTab('delay')}>Salary Delay</button>
        <button className={`tab ${tab === 'meeting' ? 'active' : ''}`} onClick={() => setTab('meeting')}>Meeting Invite</button>
        <button className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>Email Logs</button>
      </div>

      {tab === 'compose' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Compose Email</div></div>
          <div className="card-body">
            <div className="form-row">
              <Field field={{ name: 'to', label: 'Recipient Email', type: 'email', required: true }} value={form.to} onChange={set(setForm)} />
              <Field field={{ name: 'subject', label: 'Subject', type: 'text', required: true }} value={form.subject} onChange={set(setForm)} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'category', label: 'Category', type: 'select', options: ['offer_letter', 'joining_letter', 'appointment_letter', 'increment_letter', 'promotion_letter', 'leave_notification', 'salary_delay', 'salary_slip', 'meeting', 'document_verification', 'profile_rejection', 'profile_approval', 'credentials', 'other'] }} value={form.category} onChange={set(setForm)} />
              <Field field={{ name: 'employeeId', label: 'Related Employee ID (optional)', type: 'text' }} value={form.employeeId} onChange={set(setForm)} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'message', label: 'Message (HTML allowed)', type: 'textarea', rows: 6 }} value={form.message} onChange={set(setForm)} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={submitting || !form.to || !form.subject} onClick={sendCompose}>
                {submitting ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'delay' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Salary Delay Notification</div></div>
          <div className="card-body">
            <p className="text-sm text-muted mb-16">Notify employees that their salary will be delayed.</p>
            <div className="form-row">
              <Field field={{ name: 'employeeIds', label: 'Employee IDs (comma separated)', type: 'text', required: true, hint: 'e.g. 50,51,52' }} value={Array.isArray(delayForm.employeeIds) ? delayForm.employeeIds.join(',') : delayForm.employeeIds} onChange={(k, v) => setDelayForm((f) => ({ ...f, employeeIds: v.split(',').map((s) => s.trim()).filter(Boolean).map(Number) }))} />
              <Field field={{ name: 'salaryMonth', label: 'Salary Month (1-12)', type: 'number', required: true, min: 1, max: 12 }} value={delayForm.salaryMonth} onChange={set(setDelayForm)} />
              <Field field={{ name: 'salaryYear', label: 'Year', type: 'number' }} value={delayForm.salaryYear} onChange={set(setDelayForm)} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'delayReason', label: 'Delay Reason', type: 'text' }} value={delayForm.delayReason} onChange={set(setDelayForm)} />
              <Field field={{ name: 'customMessage', label: 'Custom Message', type: 'textarea' }} value={delayForm.customMessage} onChange={set(setDelayForm)} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={submitting || !delayForm.employeeIds?.length || !delayForm.salaryMonth} onClick={sendDelay}>
                {submitting ? 'Sending...' : 'Send Notifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'meeting' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Meeting Invitation</div></div>
          <div className="card-body">
            <div className="form-row">
              <Field field={{ name: 'to', label: 'Recipient Email', type: 'email', required: true }} value={meetingForm.to} onChange={set(setMeetingForm)} />
              <Field field={{ name: 'subject', label: 'Meeting Subject', type: 'text', required: true }} value={meetingForm.subject} onChange={set(setMeetingForm)} />
              <Field field={{ name: 'meetingDate', label: 'Date', type: 'date', required: true }} value={meetingForm.meetingDate} onChange={set(setMeetingForm)} />
              <Field field={{ name: 'meetingTime', label: 'Time', type: 'text', hint: 'e.g. 11:00 AM' }} value={meetingForm.meetingTime} onChange={set(setMeetingForm)} />
              <Field field={{ name: 'location', label: 'Location', type: 'text' }} value={meetingForm.location} onChange={set(setMeetingForm)} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'message', label: 'Message', type: 'textarea' }} value={meetingForm.message} onChange={set(setMeetingForm)} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={submitting || !meetingForm.to || !meetingForm.subject || !meetingForm.meetingDate} onClick={sendMeeting}>
                {submitting ? 'Sending...' : 'Send Invitation'}
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
                  <tr><th>Sent At</th><th>To</th><th>Subject</th><th>Category</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="text-sm">{formatDateTime(l.sentAt)}</td>
                      <td className="text-sm">{l.recipient}</td>
                      <td className="text-sm" style={{ maxWidth: 260 }}>{l.subject}</td>
                      <td className="text-sm">{l.category}</td>
                      <td><StatusBadge status={l.status} labels={{ sent: 'Sent', failed: 'Failed' }} /></td>
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