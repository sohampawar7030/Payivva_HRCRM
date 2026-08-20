import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { api } from '../../api/client.js'

const FONT_OPTIONS = [
  { label: 'Times New Roman (Master Serif)', value: 'Times New Roman' },
  { label: 'Arial (Sans Serif)', value: 'Arial' },
  { label: 'Georgia (Serif)', value: 'Georgia' },
  { label: 'Courier New (Monospace)', value: 'Courier New' },
]

const LETTER_TITLES = {
  offer: 'OFFER OF APPOINTMENT',
  joining: 'JOINING LETTER',
  appointment: 'LETTER OF APPOINTMENT',
  increment: 'SALARY INCREMENT LETTER',
  promotion: 'PROMOTION LETTER',
}

const LETTER_TERMS_HEADERS = {
  offer: 'Terms of Employment',
  joining: 'Joining Guidelines & Terms',
  appointment: 'Appointment Terms & Conditions',
  increment: 'Terms & Guidelines',
  promotion: 'Promotion Guidelines & Responsibilities',
}

const DEFAULT_TERMS_MAP = {
  offer: [
    'Employment is full-time.',
    'You are expected to maintain confidentiality of all company and client information.',
    'You may be assigned to projects at different client locations as required.',
    'You must comply with all company policies and professional standards.',
    'This offer is subject to verification of the documents submitted.',
  ],
  joining: [
    'You have successfully completed the initial document verification process.',
    'You will adhere to company attendance, reporting timings, and safety standards.',
    'You are required to maintain complete confidentiality regarding client data and projects.',
    'Your performance will be reviewed as per standard company appraisal procedures.',
  ],
  appointment: [
    'Employment is governed by company service rules and professional standards.',
    'You will be under probation for a period of six months from the appointment date.',
    'Confidentiality of company proprietary code and client contracts must be preserved.',
    'Standard notice period rules will apply as outlined in company employment policies.',
  ],
  increment: [
    'The terms of your compensation structure remain strictly confidential.',
    'All other terms and conditions of your employment remain unchanged.',
    'We look forward to your continued dedication and excellence in upcoming projects.',
  ],
  promotion: [
    'You will be responsible for leading project execution and team guidance in your new role.',
    'The compensation details remain confidential between you and the company management.',
    'All other standard employment policies and professional guidelines continue to apply.',
  ],
}

export default function LetterEditorModal({
  open,
  onClose,
  initialData = {},
  onSave,
  submitting = false,
}) {
  const toast = useToast()

  const letterType = initialData.letterType || 'offer'
  const letterTitle = LETTER_TITLES[letterType] || 'OFFER OF APPOINTMENT'
  const termsHeader = LETTER_TERMS_HEADERS[letterType] || 'Terms of Employment'

  // Document Fields State
  const [empName, setEmpName] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [designation, setDesignation] = useState('')
  const [prevDesignation, setPrevDesignation] = useState('Technician')
  const [department, setDepartment] = useState('')
  const [workLocation, setWorkLocation] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [salary, setSalary] = useState('27000')
  const [prevSalary, setPrevSalary] = useState('24000')
  const [dateStr, setDateStr] = useState(new Date().toLocaleDateString('en-GB'))
  const [terms, setTerms] = useState([])

  // Live Style & Logo Controls
  const [fontFamily, setFontFamily] = useState('Times New Roman')
  const [logoWidth, setLogoWidth] = useState(300)
  const [logoHeight, setLogoHeight] = useState(110)
  const [logoOffsetX, setLogoOffsetX] = useState(16)
  const [logoOffsetY, setLogoOffsetY] = useState(15)
  const [logoGap, setLogoGap] = useState(10)

  // Step state: 'editor' | 'pdf_check'
  const [step, setStep] = useState('editor')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null)
  const [previewBase64, setPreviewBase64] = useState('')

  useEffect(() => {
    if (open && initialData) {
      setEmpName(initialData.empName || '')
      setEmpCode(initialData.empCode || '')
      setDesignation(initialData.designation || 'ELV SECUIRITY SYTEM TECHNICIAN')
      setPrevDesignation(initialData.prevDesignation || 'Junior Technician')
      setDepartment(initialData.department || 'ELV & Secuirity Systems')
      setWorkLocation(initialData.workLocation || 'Pune & PAN INDIA As per project requirement')
      setJoiningDate(initialData.joiningDate || new Date().toISOString().substring(0, 10))
      setEffectiveDate(initialData.effectiveDate || new Date().toISOString().substring(0, 10))
      setSalary(initialData.salary ? String(initialData.salary) : '27000')
      setPrevSalary(initialData.prevSalary ? String(initialData.prevSalary) : '24000')

      const initialTerms = (initialData.terms && initialData.terms.length > 0)
        ? initialData.terms
        : (DEFAULT_TERMS_MAP[letterType] || DEFAULT_TERMS_MAP.offer)
      setTerms(initialTerms)

      setFontFamily(initialData.fontFamily || localStorage.getItem('hrcrm_font_family') || 'Times New Roman')
      setLogoWidth(Number(initialData.logoWidth || localStorage.getItem('hrcrm_logo_width') || 300))
      setLogoHeight(Number(initialData.logoHeight || localStorage.getItem('hrcrm_logo_height') || 110))
      setLogoOffsetX(Number(initialData.logoOffsetX ?? (localStorage.getItem('hrcrm_logo_offset_x') ?? 16)))
      setLogoOffsetY(Number(initialData.logoOffsetY ?? (localStorage.getItem('hrcrm_logo_offset_y') ?? 15)))
      setLogoGap(Number(initialData.logoGap ?? (localStorage.getItem('hrcrm_logo_gap') ?? 10)))
      setStep('editor')
      setPreviewPdfUrl(null)
    }
  }, [open, initialData, letterType])

  const handleAddTerm = () => setTerms([...terms, ''])
  const handleUpdateTerm = (idx, val) => {
    const next = [...terms]
    next[idx] = val
    setTerms(next)
  }
  const handleRemoveTerm = (idx) => setTerms(terms.filter((_, i) => i !== idx))

  // Step 1: Generate PDF Blob for Actual Layout Check
  const handleCheckPdf = async () => {
    if (!empName.trim()) {
      toast.error('Employee Name is required')
      return
    }

    setPreviewLoading(true)
    try {
      localStorage.setItem('hrcrm_font_family', fontFamily)
      localStorage.setItem('hrcrm_logo_width', logoWidth)
      localStorage.setItem('hrcrm_logo_height', logoHeight)
      localStorage.setItem('hrcrm_logo_offset_x', logoOffsetX)
      localStorage.setItem('hrcrm_logo_offset_y', logoOffsetY)
      localStorage.setItem('hrcrm_logo_gap', logoGap)

      const payload = {
        employeeId: initialData.selectedEmpId || 0,
        letterType,
        title: letterTitle,
        extra: {
          employeeName: empName,
          employeeCode: empCode,
          designation,
          prevDesignation,
          department,
          workLocation,
          joiningDate,
          effectiveDate,
          salary: Number(salary) || 27000,
          prevSalary: Number(prevSalary) || 24000,
          termsOfEmployment: terms.filter((t) => t.trim().length > 0),
          fontFamily,
          logoWidth,
          logoHeight,
          logoOffsetX,
          logoOffsetY,
          logoGap,
        },
      }

      const res = await api.post('/letters/preview', payload)
      const b64 = res.data?.pdfBase64
      if (!b64) throw new Error('No PDF base64 returned')

      const byteCharacters = atob(b64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setPreviewPdfUrl(url)
      setPreviewBase64(b64)
      setStep('pdf_check')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setPreviewLoading(false)
    }
  }

  // Step 2: Final Save to Database
  const handleFinalSave = () => {
    const payload = {
      empName,
      empCode,
      designation,
      prevDesignation,
      department,
      workLocation,
      joiningDate,
      effectiveDate,
      salary: Number(salary) || 27000,
      prevSalary: Number(prevSalary) || 24000,
      terms: terms.filter((t) => t.trim().length > 0),
      fontFamily,
      logoWidth,
      logoHeight,
      logoOffsetX,
      logoOffsetY,
      logoGap,
    }
    onSave(payload)
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'pdf_check' ? `📄 Actual Generated ${letterTitle} Format Check` : `📝 Interactive ${letterTitle} Editor & Live Preview`}
      wide
    >
      {step === 'pdf_check' ? (
        /* STEP 2: ACTUAL GENERATED PDF CHECK SCREEN */
        <div>
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e40af' }}>
                🔍 Check Your Actual Generated PDF Output ({letterTitle})
              </div>
              <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                Verify logo size, optical centering, gap below logo, font style, and digital stamp before saving.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {previewPdfUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#2563eb', fontWeight: 'bold' }}
                  onClick={() => window.open(previewPdfUrl, '_blank')}
                >
                  🔗 Open Fullscreen PDF
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStep('editor')}
                style={{ fontWeight: 'bold' }}
              >
                ✏️ Back to Edit & Adjust
              </button>
            </div>
          </div>

          {/* Embedded PDF Viewer */}
          <div style={{ background: '#334155', padding: '10px', borderRadius: '8px' }}>
            {previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                title={`${letterTitle} PDF Check`}
                style={{
                  width: '100%',
                  height: '560px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#ffffff',
                }}
              />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>Loading PDF preview...</div>
            )}
          </div>

          {/* PDF Check Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep('editor')}>
              ✏️ Back to Edit
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleFinalSave} disabled={submitting}>
                {submitting ? 'Saving to Database...' : '💾 Save & Issue Letter'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 1: INTERACTIVE DOCUMENT EDITOR SHEET */
        <div>
          {/* TOP LIVE FORMATTING TOOLBAR */}
          <div
            style={{
              background: '#1e293b',
              color: '#ffffff',
              padding: '14px 18px',
              borderRadius: '8px',
              marginBottom: '20px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '12px', color: '#93c5fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🎛️ Live Logo Size, Spacing & Font Controls ({letterTitle})</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 'normal' }}>Adjust sliders to increase/decrease logo size & gap live</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'center' }}>
              {/* Font Family Selector */}
              <div>
                <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Font Style</label>
                <select
                  className="form-control"
                  style={{ background: '#0f172a', color: '#fff', borderColor: '#334155', fontSize: '12px' }}
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Logo Size / Width Slider */}
              <div>
                <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Logo Size (Width: {logoWidth}px)
                </label>
                <input
                  type="range"
                  min="100"
                  max="480"
                  step="5"
                  value={logoWidth}
                  onChange={(e) => setLogoWidth(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Logo Gap Below Slider */}
              <div>
                <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Gap Below Logo ({logoGap}px)
                </label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="2"
                  value={logoGap}
                  onChange={(e) => setLogoGap(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Logo Shift Horizontal Slider */}
              <div>
                <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Shift Right/Left ({logoOffsetX > 0 ? `+${logoOffsetX}` : logoOffsetX}px)
                </label>
                <input
                  type="range"
                  min="-50"
                  max="60"
                  value={logoOffsetX}
                  onChange={(e) => setLogoOffsetX(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Logo Top Y Margin Slider */}
              <div>
                <label style={{ fontSize: '11px', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Top Margin (Y: {logoOffsetY}px)
                </label>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={logoOffsetY}
                  onChange={(e) => setLogoOffsetY(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* LIVE DOCUMENT SHEET (A4 Simulation View) */}
          <div
            style={{
              background: '#525659',
              padding: '20px',
              borderRadius: '8px',
              overflowX: 'auto',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                color: '#000000',
                width: '100%',
                maxWidth: '750px',
                margin: '0 auto',
                padding: '40px 45px',
                borderRadius: '2px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                fontFamily: fontFamily === 'Times New Roman' ? '"Times New Roman", Times, serif' : fontFamily,
                boxSizing: 'border-box',
              }}
            >
              {/* Logo Top Header */}
              <div style={{ textAlign: 'center', position: 'relative', marginTop: `${logoOffsetY - 10}px`, marginBottom: `${logoGap + 10}px` }}>
                <img
                  src="/imp_doc/company_logo.png"
                  alt="Company Logo"
                  style={{
                    width: `${logoWidth}px`,
                    transform: `translateX(${logoOffsetX}px)`,
                    display: 'inline-block',
                    transition: 'all 0.1s ease',
                  }}
                />
              </div>

              {/* Main Title */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#b8860b', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                  {letterTitle}
                </h2>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED</div>
                <div style={{ fontSize: '12px', color: '#333' }}>House No. 105, Green Park, Venkatesh Properties, Undri, Pune - 411060</div>
                <div style={{ fontSize: '12px', color: '#333' }}>www.payivvatechnologies.in | +91 8380009994 / +91 8380009995</div>
              </div>

              {/* Date & Salutation */}
              <div style={{ marginBottom: '16px', fontSize: '14px' }}>
                <div>Date: {dateStr}</div>
                <div style={{ marginTop: '12px' }}>
                  Dear Mr./Ms.{' '}
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      fontWeight: 'bold',
                      border: '1px dashed #cbd5e1',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#fef08a',
                      width: '220px',
                    }}
                  />
                  ,
                </div>
              </div>

              {/* Dynamic Opening Paragraph */}
              <div style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '22px', textAlign: 'justify' }}>
                {letterType === 'joining' && (
                  <span>
                    We are pleased to confirm your joining as “
                    <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ fontWeight: 'bold', border: '1px dashed #cbd5e1', background: '#fef08a', padding: '2px 4px', borderRadius: '4px', fontFamily: 'inherit' }} />
                    ” with PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED effective from {joiningDate}. We welcome you aboard and look forward to a rewarding professional career together.
                  </span>
                )}
                {letterType === 'appointment' && (
                  <span>
                    Following your acceptance of our offer, PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED is pleased to appoint you as “
                    <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ fontWeight: 'bold', border: '1px dashed #cbd5e1', background: '#fef08a', padding: '2px 4px', borderRadius: '4px', fontFamily: 'inherit' }} />
                    ” with effect from {joiningDate}.
                  </span>
                )}
                {letterType === 'increment' && (
                  <span>
                    In recognition of your performance, dedication, and valuable contributions to PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED, we are pleased to inform you that your monthly salary has been revised effective from {effectiveDate}.
                  </span>
                )}
                {letterType === 'promotion' && (
                  <span>
                    We are delighted to inform you that in recognition of your outstanding performance, technical leadership, and commitment, you are being promoted to the position of “
                    <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ fontWeight: 'bold', border: '1px dashed #cbd5e1', background: '#fef08a', padding: '2px 4px', borderRadius: '4px', fontFamily: 'inherit' }} />
                    ” effective from {effectiveDate}.
                  </span>
                )}
                {letterType === 'offer' && (
                  <span>
                    We are pleased to offer you the position of “
                    <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ fontWeight: 'bold', border: '1px dashed #cbd5e1', background: '#fef08a', padding: '2px 6px', borderRadius: '4px', fontFamily: 'inherit', width: '260px' }} />
                    ” with PAYIVVA TECHNOLOGIES (OPC) PRIVATE LIMITED. We are confident that your skills and dedication will contribute to the continued success of our organization.
                  </span>
                )}
              </div>

              {/* Dynamic Grid Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', border: '1px solid #000' }} border="1" cellPadding="8">
                <tbody>
                  <tr>
                    <td style={{ width: '32%', fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Employee ID</td>
                    <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                      <input type="text" value={empCode} onChange={(e) => setEmpCode(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Employee Name</td>
                    <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                      <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                    </td>
                  </tr>

                  {letterType === 'promotion' ? (
                    <>
                      <tr>
                        <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Previous Designation</td>
                        <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                          <input type="text" value={prevDesignation} onChange={(e) => setPrevDesignation(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>New Promoted Designation</td>
                        <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                          <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Designation</td>
                      <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                        <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Work Location</td>
                    <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                      <input type="text" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Department</td>
                    <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                      <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} style={{ width: '100%', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                    </td>
                  </tr>

                  {(letterType === 'increment' || letterType === 'promotion') ? (
                    <tr>
                      <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Effective Date</td>
                      <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={{ border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Joining Date</td>
                      <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                        <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} style={{ border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} />
                      </td>
                    </tr>
                  )}

                  {letterType === 'increment' && (
                    <tr>
                      <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>Previous Monthly Salary</td>
                      <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                        Rs. <input type="text" value={prevSalary} onChange={(e) => setPrevSalary(e.target.value)} style={{ width: '130px', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} /> /-
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ fontWeight: 'bold', border: '1px solid #000', fontSize: '13px' }}>{letterType === 'increment' || letterType === 'promotion' ? 'Revised Monthly Salary' : 'Monthly Salary'}</td>
                    <td style={{ fontWeight: 'normal', border: '1px solid #000', fontSize: '13px' }}>
                      Rs. <input type="text" value={salary} onChange={(e) => setSalary(e.target.value)} style={{ width: '130px', border: 'none', background: '#fef08a', fontWeight: 'normal', fontSize: '13px', fontFamily: 'inherit' }} /> /-
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Dynamic Terms of Employment Section */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ color: '#2b6cb0', margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{termsHeader}</h4>
                  <button type="button" onClick={handleAddTerm} style={{ fontSize: '11px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>
                    + Add Point
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.7' }}>
                  {terms.map((t, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={t}
                          onChange={(e) => handleUpdateTerm(idx, e.target.value)}
                          style={{ flex: 1, border: '1px dashed #cbd5e1', padding: '3px 8px', fontSize: '13px', fontFamily: 'inherit', borderRadius: '4px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTerm(idx)}
                          style={{ background: 'transparent', color: '#ef4444', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ fontSize: '14px', marginBottom: '20px' }}>Please sign below as your acceptance of this document.</div>

              {/* Acceptance & Signature Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }} border="1" cellPadding="10">
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top', border: '1px solid #000' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>For PAYIVVA TECHNOLOGIES</div>
                      <img src="/imp_doc/digital_sign.png" alt="Digital Signature" style={{ height: '54px', display: 'block', marginBottom: '8px' }} />
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Authorized Signatory</div>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top', border: '1px solid #000' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '48px' }}>Accepted By</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{empName || 'Candidate'}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={previewLoading}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCheckPdf} disabled={previewLoading}>
              {previewLoading ? 'Generating PDF Check...' : '🔍 Check & Preview Final PDF'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
