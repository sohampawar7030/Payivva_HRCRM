import { useEffect, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDate } from '../../utils/format.js'
import { openFile } from '../../utils/files.js'
import { LETTER_TYPES, LETTER_TYPE_LABELS } from '../../../../shared/constants.js'

export default function ItLetters() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [form, setForm] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [sendTarget, setSendTarget] = useState(null)

  const load = () => {
    api.get('/letters', { limit: 200 }).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const generate = async () => {
    setSubmitting(true)
    try {
      await api.post('/letters', {
        employeeId: Number(form.employeeId),
        letterType: form.letterType,
        title: form.title || `${LETTER_TYPE_LABELS[form.letterType]} - ${form.employeeName || ''}`.trim(),
        extra: form.extra || {},
      })
      toast.success('Letter generated')
      setShowGenerate(false)
      setForm({})
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const sendEmail = async () => {
    try {
      const res = await api.post(`/letters/${sendTarget.id}/send`, {})
      toast.success(res.message || 'Letter email sent')
      setSendTarget(null)
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  const openPdf = (id) => openFile(`/letters/${id}/pdf`)

  if (!rows) return <LoadingPage label="Loading letters..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Company Letters</div>
          <div className="page-subtitle">Generate offer, joining, appointment, increment and promotion letters</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>+ Generate Letter</button>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">All Letters</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="📄" title="No letters generated yet" />}
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Employee</th><th>Type</th><th>Version</th><th>Generated</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.title}</strong></td>
                  <td className="text-sm">{l.employeeName}<div className="text-xs text-muted">{l.employeeCode}</div></td>
                  <td className="text-sm">{LETTER_TYPE_LABELS[l.letterType] || l.letterType}</td>
                  <td>v{l.version}</td>
                  <td className="text-sm">{formatDate(l.generatedAt)}</td>
                  <td><StatusBadge status={l.status} labels={{ generated: 'Generated', sent: 'Sent' }} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openPdf(l.id)}>PDF</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSendTarget(l)}>Email</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Letter" wide>
        <div className="form-row">
          <Field field={{ name: 'employeeId', label: 'Employee ID', type: 'text', required: true, hint: 'numeric internal ID' }} value={form.employeeId} onChange={set} />
          <Field field={{ name: 'employeeName', label: 'Employee Name (for title)', type: 'text' }} value={form.employeeName} onChange={set} />
          <Field field={{ name: 'letterType', label: 'Letter Type', type: 'select', required: true, options: LETTER_TYPES.map((t) => ({ value: t, label: LETTER_TYPE_LABELS[t] })) }} value={form.letterType} onChange={set} />
          <Field field={{ name: 'title', label: 'Title (optional)', type: 'text' }} value={form.title} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'extra', label: 'Extra JSON details (optional)', type: 'textarea', hint: 'e.g. {"incrementAmount": 5000}' }} value={typeof form.extra === 'string' ? form.extra : JSON.stringify(form.extra || {})} onChange={(k, v) => {
            try { set('extra', v ? JSON.parse(v) : {}) } catch { set('extra', v) }
          }} />
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={submitting || !form.employeeId || !form.letterType} onClick={generate}>
            {submitting ? 'Generating...' : 'Generate Letter'}
          </button>
        </div>
      </Modal>

      <Modal open={!!sendTarget} onClose={() => setSendTarget(null)} title="Email Letter">
        {sendTarget && (
          <div>
            <p className="text-sm text-muted mb-16">
              Send <strong>{sendTarget.title}</strong> (v{sendTarget.version}) to <strong>{sendTarget.employeeName}</strong> at their official email address?
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setSendTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendEmail}>Send Email</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}