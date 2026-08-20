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

const DEFAULT_TERMS = [
  'Employment is full-time.',
  'You are expected to maintain confidentiality of all company and client information.',
  'You may be assigned to projects at different client locations as required.',
  'You must comply with all company policies and professional standards.',
  'This offer is subject to verification of the documents submitted.',
]

function generateEmployeeCodePreview(name) {
  const parts = String(name || 'Employee').trim().split(/\s+/)
  const firstChar = (parts[0] || 'E')[0].toUpperCase()
  const lastChar = (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || 'M')).toUpperCase()
  const randomDigits = Math.floor(1000 + Math.random() * 9000)
  return `PAYIVVA_${firstChar}${lastChar}${randomDigits}`
}

import LetterEditorModal from '../../components/letters/LetterEditorModal.jsx'

export default function ItLetters() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [workers, setWorkers] = useState([])
  const [showGenerate, setShowGenerate] = useState(false)
  const [showEditorModal, setShowEditorModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sendTarget, setSendTarget] = useState(null)

  // Offer Letter Form State
  const [letterType, setLetterType] = useState('offer')
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [empName, setEmpName] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [workLocation, setWorkLocation] = useState('Pune & PAN INDIA As per project requirement')
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().substring(0, 10))
  const [salary, setSalary] = useState('27000')
  const [terms, setTerms] = useState(DEFAULT_TERMS)
  const [title, setTitle] = useState('')
  const [extraJson, setExtraJson] = useState('{}')

  // Logo Customization Settings State (Defaults locked to perfect master template)
  const [logoWidth, setLogoWidth] = useState(() => localStorage.getItem('hrcrm_logo_width') || '300')
  const [logoHeight, setLogoHeight] = useState(() => localStorage.getItem('hrcrm_logo_height') || '110')
  const [logoOffsetX, setLogoOffsetX] = useState(() => localStorage.getItem('hrcrm_logo_offset_x') || '16')
  const [logoOffsetY, setLogoOffsetY] = useState(() => localStorage.getItem('hrcrm_logo_offset_y') || '15')
  const [logoGap, setLogoGap] = useState(() => localStorage.getItem('hrcrm_logo_gap') || '10')
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('hrcrm_font_family') || 'Times New Roman')
  const [showLogoSettings, setShowLogoSettings] = useState(false)

  const saveLogoSettings = () => {
    localStorage.setItem('hrcrm_logo_width', logoWidth)
    localStorage.setItem('hrcrm_logo_height', logoHeight)
    localStorage.setItem('hrcrm_logo_offset_x', logoOffsetX)
    localStorage.setItem('hrcrm_logo_offset_y', logoOffsetY)
    localStorage.setItem('hrcrm_logo_gap', logoGap)
    localStorage.setItem('hrcrm_font_family', fontFamily)
    toast.success('Logo position & size settings saved successfully!')
  }

  const load = () => {
    api.get('/letters', { limit: 200 }).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
    api.get('/workers', { limit: 500 }).then((res) => setWorkers(res.data.rows || [])).catch(() => setWorkers([]))
  }
  useEffect(load, [])

  const handleSelectEmployee = (eId) => {
    setSelectedEmpId(eId)
    const emp = workers.find((w) => String(w.id) === String(eId))
    if (emp) {
      setEmpName(emp.name || '')
      setDesignation(emp.designation || 'ELV SECUIRITY SYTEM TECHNICIAN')
      setDepartment(emp.department || 'ELV & Secuirity Systems')
      setWorkLocation(emp.workLocation || 'Pune & PAN INDIA As per project requirement')
      setSalary(emp.salary ? String(emp.salary) : '27000')
      if (emp.joining_date) {
        setJoiningDate(emp.joining_date.substring(0, 10))
      }
      const code = emp.employee_id || generateEmployeeCodePreview(emp.name)
      setEmpCode(code)
    }
  }

  const addTerm = () => setTerms([...terms, ''])
  const updateTerm = (index, val) => {
    const updated = [...terms]
    updated[index] = val
    setTerms(updated)
  }
  const removeTerm = (index) => setTerms(terms.filter((_, i) => i !== index))

  const openLiveEditor = () => {
    if (!selectedEmpId) {
      toast.error('Please select an employee first')
      return
    }
    setShowEditorModal(true)
  }

  const handleSaveFromEditor = async (editorData) => {
    setSubmitting(true)
    try {
      const extraObj = {
        employeeName: editorData.empName,
        employeeCode: editorData.empCode,
        designation: editorData.designation,
        department: editorData.department,
        workLocation: editorData.workLocation,
        joiningDate: editorData.joiningDate,
        salary: Number(editorData.salary) || 27000,
        termsOfEmployment: editorData.terms,
        fontFamily: editorData.fontFamily || 'Times New Roman',
        logoWidth: Number(editorData.logoWidth) || 300,
        logoHeight: Number(editorData.logoHeight) || 110,
        logoOffsetX: editorData.logoOffsetX != null ? Number(editorData.logoOffsetX) : 16,
        logoOffsetY: editorData.logoOffsetY != null ? Number(editorData.logoOffsetY) : 15,
        logoGap: editorData.logoGap != null ? Number(editorData.logoGap) : 10,
      }

      const letterTitle = title || `${LETTER_TYPE_LABELS[letterType]} - ${editorData.empName || ''}`.trim()

      await api.post('/letters', {
        employeeId: Number(selectedEmpId),
        letterType,
        title: letterTitle,
        extra: extraObj,
      })
      toast.success('Offer Letter generated and saved successfully!')
      setShowEditorModal(false)
      setShowGenerate(false)
      resetForm()
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedEmpId('')
    setEmpName('')
    setEmpCode('')
    setDesignation('')
    setDepartment('')
    setWorkLocation('Pune & PAN INDIA As per project requirement')
    setJoiningDate(new Date().toISOString().substring(0, 10))
    setSalary('27000')
    setTerms(DEFAULT_TERMS)
    setTitle('')
    setExtraJson('{}')
    setLetterType('offer')
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

  const handleDeleteLetter = async (row) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete "${row.title}" (v${row.version})? This action cannot be undone.`)) {
      return
    }
    try {
      await api.del(`/letters/${row.id}`)
      toast.success('Letter permanently deleted successfully')
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  if (!rows) return <LoadingPage label="Loading letters..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Letters</h1>
          <p className="page-subtitle">Generate offer, joining, appointment, increment and promotion letters</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowGenerate(true) }}>+ Generate Letter</button>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">All Letters</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="📄" title="No letters generated yet" />}
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Employee</th><th>Type</th><th>Version</th><th>Generated</th><th>Status</th><th>Actions</th></tr>
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
                  <td style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openPdf(l.id)}>View PDF</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSendTarget(l)}>Email</button>
                    <button className="btn btn-ghost btn-sm text-danger" style={{ color: '#ef4444', fontWeight: 'bold' }} onClick={() => handleDeleteLetter(l)}>
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Company Letter" wide>
        <div className="form-row">
          <Field
            field={{
              name: 'letterType',
              label: 'Letter Type',
              type: 'select',
              required: true,
              options: LETTER_TYPES.map((t) => ({ value: t, label: LETTER_TYPE_LABELS[t] })),
            }}
            value={letterType}
            onChange={(_, v) => setLetterType(v)}
          />

          <Field
            field={{
              name: 'employeeId',
              label: 'Select Employee',
              type: 'select',
              required: true,
              options: workers.map((w) => ({ value: w.id, label: `${w.name} (${w.employee_id || 'ID pending'}) - ${w.designation || 'Worker'}` })),
            }}
            value={selectedEmpId}
            onChange={(_, v) => handleSelectEmployee(v)}
          />
        </div>

        {letterType === 'offer' && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', color: '#1e40af', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              Offer Letter Details
            </div>
            <div className="form-row">
              <Field field={{ name: 'employeeCode', label: 'Employee ID (Code)', type: 'text', hint: 'Auto-generated format if not present in DB' }} value={empCode} onChange={(_, v) => setEmpCode(v)} />
              <Field field={{ name: 'empName', label: 'Employee Full Name', type: 'text', required: true }} value={empName} onChange={(_, v) => setEmpName(v)} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'designation', label: 'Designation', type: 'text', required: true }} value={designation} onChange={(_, v) => setDesignation(v)} />
              <Field field={{ name: 'department', label: 'Department', type: 'text', required: true }} value={department} onChange={(_, v) => setDepartment(v)} />
            </div>
            <div className="form-row">
              <Field field={{ name: 'workLocation', label: 'Work Location', type: 'text' }} value={workLocation} onChange={(_, v) => setWorkLocation(v)} />
              <Field field={{ name: 'joiningDate', label: 'Joining Date', type: 'date', required: true }} value={joiningDate} onChange={(_, v) => setJoiningDate(v)} />
              <Field field={{ name: 'salary', label: 'Monthly Salary (Rs.)', type: 'number', required: true }} value={salary} onChange={(_, v) => setSalary(v)} />
            </div>

            <div style={{ marginTop: '15px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>
                  🎨 Company Logo Position & Size Adjustment (Editable)
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#2563eb', fontWeight: 'bold' }}
                  onClick={() => setShowLogoSettings(!showLogoSettings)}
                >
                  {showLogoSettings ? '▲ Hide Settings' : '✏️ Adjust Logo Position & Size'}
                </button>
              </div>

              {showLogoSettings && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div className="form-row">
                    <Field
                      field={{ name: 'logoWidth', label: 'Logo Width (px)', type: 'number', hint: 'Default: 260' }}
                      value={logoWidth}
                      onChange={(_, v) => setLogoWidth(v)}
                    />
                    <Field
                      field={{ name: 'logoOffsetX', label: 'Shift Right (+) / Left (-) (px)', type: 'number', hint: 'Default: +16' }}
                      value={logoOffsetX}
                      onChange={(_, v) => setLogoOffsetX(v)}
                    />
                    <Field
                      field={{ name: 'logoOffsetY', label: 'Top Margin / Y-Offset (px)', type: 'number', hint: 'Default: 15' }}
                      value={logoOffsetY}
                      onChange={(_, v) => setLogoOffsetY(v)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={saveLogoSettings}>
                      💾 Save Logo Settings
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>Terms of Employment (Bullet Points)</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addTerm} style={{ color: '#2563eb' }}>
                  + Add Point
                </button>
              </div>

              {terms.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>•</span>
                  <input
                    type="text"
                    className="form-control"
                    style={{ flex: 1 }}
                    value={t}
                    onChange={(e) => updateTerm(idx, e.target.value)}
                    placeholder={`Term #${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    onClick={() => removeTerm(idx)}
                    title="Remove term"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {letterType !== 'offer' && (
          <div className="form-row" style={{ marginTop: '15px' }}>
            <Field field={{ name: 'title', label: 'Title (optional)', type: 'text' }} value={title} onChange={(_, v) => setTitle(v)} />
            <Field field={{ name: 'extraJson', label: 'Extra JSON details (optional)', type: 'textarea' }} value={extraJson} onChange={(_, v) => setExtraJson(v)} />
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={submitting || !selectedEmpId} onClick={openLiveEditor}>
            👁️ Open Live Word-like Editor & Preview
          </button>
        </div>
      </Modal>

      <LetterEditorModal
        open={showEditorModal}
        onClose={() => setShowEditorModal(false)}
        initialData={{
          selectedEmpId,
          letterType,
          empName,
          empCode,
          designation,
          prevDesignation: 'Technician',
          department,
          workLocation,
          joiningDate,
          effectiveDate: joiningDate,
          salary,
          prevSalary: '24000',
          terms,
          fontFamily,
          logoWidth,
          logoHeight,
          logoOffsetX,
          logoOffsetY,
          logoGap,
        }}
        onSave={handleSaveFromEditor}
        submitting={submitting}
      />

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