import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage } from '../../components/ui/Feedback.jsx'
import { ProgressBar } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Field, ChipSelect } from '../../components/ui/Form.jsx'
import { ConfirmDialog } from '../../components/ui/Modal.jsx'
import { formatDate } from '../../utils/format.js'
import { IT_SKILLS, NON_IT_SKILLS, ASSET_OPTIONS } from '../../../../shared/constants.js'

const SECTIONS = [
  { key: 'personal', label: 'Personal Information', icon: '👤' },
  { key: 'contact', label: 'Contact & Family', icon: '📞' },
  { key: 'education', label: 'Education', icon: '🎓' },
  { key: 'employment', label: 'Employment & Bank', icon: '💼' },
  { key: 'skills', label: 'Skills', icon: '🛠️' },
  { key: 'documents', label: 'Documents', icon: '📁' },
  { key: 'assets', label: 'Company Assets', icon: '💻' },
]

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <div className="card mb-16">
      <div className="card-header">
        <div className="flex items-center gap-12">
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div className="card-title">{title}</div>
            {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
          </div>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

export default function WorkerProfile() {
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [active, setActive] = useState('personal')
  const [saving, setSaving] = useState(false)
  const [submitModal, setSubmitModal] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [assets, setAssets] = useState([])
  const [assetSaving, setAssetSaving] = useState(false)

  const load = useCallback(() => {
    api.get('/me/profile').then((res) => {
      setProfile(res.data)
      const existing = res.data.assets || []
      setAssets(existing.map((a) => a.component))
    }).catch(() => {})
  }, [])

  useEffect(load, [load])

  if (!profile) return <LoadingPage label="Loading your profile..." />

  const { employee, personal, contact, education, employment, skills, verification, documents, user, profileCompletion, canEdit } = profile
  const status = verification?.profileStatus || 'not_started'
  const locked = !canEdit
  const submitted = ['submitted', 'it_approved', 'fully_verified'].includes(status)

  const saveSection = async (section, payload) => {
    setSaving(true)
    try {
      await api.put(`/me/profile/${section}`, payload)
      toast.success(status === 'fully_verified' ? 'Profile updated successfully' : 'Section saved')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAssets = async () => {
    setAssetSaving(true)
    try {
      await api.post('/me/profile/assets', { assets })
      toast.success('Assets saved')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setAssetSaving(false)
    }
  }

  const submitProfile = async () => {
    setSubmitLoading(true)
    try {
      await api.post('/me/profile/submit')
      toast.success('Profile submitted for verification')
      setSubmitModal(false)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSubmitLoading(false)
    }
  }

  const sections = profileCompletion.sections

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My Employee Profile</div>
          <div className="page-subtitle">{employee.employee_id} · {employee.designation || '—'} · {employee.department || '—'}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      {locked && submitted && (
        <div className="card-pad mb-16" style={{ background: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: 10 }}>
          <strong>🔒 Your profile is under verification.</strong>
          <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>
            {status === 'submitted'
              ? <>Your application is at the <strong>IT Desk</strong> — waiting for IT approval. Then it moves to the Director Desk.</>
              : <>Your application is at the <strong>Director Desk</strong> — waiting for final approval.</>}
          </div>
        </div>
      )}
      {status === 'fully_verified' && (
        <div className="card-pad mb-16" style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 10 }}>
          <strong className="text-success">✔ Profile verified & updated successfully.</strong>
          <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>
            Both IT and Director approvals are complete. You can now update your profile anytime — no re-approval needed.
          </div>
        </div>
      )}
      {status === 'it_rejected' && (
        <div className="card-pad mb-16" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 10 }}>
          <strong className="text-danger">✕ Profile rejected by IT.</strong>
          {verification.itRemarks && <div className="text-sm mt-8">Reason: {verification.itRemarks}</div>}
          <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>Please correct the information and resubmit.</div>
        </div>
      )}
      {status === 'director_rejected' && (
        <div className="card-pad mb-16" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 10 }}>
          <strong className="text-danger">✕ Profile rejected by Director.</strong>
          {verification.directorRemarks && <div className="text-sm mt-8">Reason: {verification.directorRemarks}</div>}
          <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>Please correct the information and resubmit.</div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '260px 1fr', gap: 20 }}>
        <div>
          <div className="side-card">
            <div className="side-card-title">Profile Completion</div>
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold" style={{ fontSize: 18 }}>{profileCompletion.percent}%</span>
            </div>
            <ProgressBar percent={profileCompletion.percent} />
            <div className="mt-16">
              {sections.map((s) => (
                <div key={s.key} className={`check-item ${s.done ? 'done' : 'pending'}`} style={{ cursor: 'pointer' }} onClick={() => setActive(s.key)}>
                  <span className={`check-icon ${s.done ? 'done' : 'pending'}`}>{s.done ? '✓' : '•'}</span>
                  <span className="text-sm">{SECTIONS.find((x) => x.key === s.key)?.label || s.key}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="side-card">
            <div className="side-card-title">Account</div>
            <div className="text-sm text-muted">{user?.email}</div>
            <div className="text-xs text-muted mt-8">Joined: {formatDate(employee.joining_date)}</div>
          </div>

          <div className="side-card">
            <div className="side-card-title">Action</div>
            {status === 'fully_verified' ? (
              <div>
                <span className="badge badge-success btn-block text-center">✔ Approved & Updated</span>
                <div className="text-xs text-muted mt-8 text-center">Both approvals done — profile is editable anytime.</div>
              </div>
            ) : !submitted ? (
              <button
                className="btn btn-success btn-block"
                disabled={profileCompletion.percent < 100 || locked}
                onClick={() => setSubmitModal(true)}
                title={profileCompletion.percent < 100 ? `Complete all sections (${profileCompletion.percent}%) first` : ''}
              >
                Submit for Verification
              </button>
            ) : (
              <span className="badge badge-blue btn-block text-center">
                {status === 'submitted' ? '⏳ At IT Desk — awaiting approval' : '⏳ At Director Desk — awaiting approval'}
              </span>
            )}
            {profileCompletion.percent < 100 && (
              <div className="text-xs text-muted mt-8 text-center">Complete all sections to submit ({profileCompletion.percent}%)</div>
            )}
          </div>
        </div>

        <div>
          <div className="tabs">
            {SECTIONS.map((s) => (
              <button key={s.key} className={`tab ${active === s.key ? 'active' : ''}`} onClick={() => setActive(s.key)}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {active === 'personal' && (
            <PersonalSection data={personal} employee={employee} locked={locked} saving={saving} onSave={(payload) => saveSection('personal', { section: 'personal', data: payload })} />
          )}
          {active === 'contact' && (
            <ContactSection data={contact} employee={employee} locked={locked} saving={saving} onSave={(payload) => saveSection('contact', { section: 'contact', data: payload })} />
          )}
          {active === 'education' && (
            <EducationSection data={education} locked={locked} saving={saving} onSave={(payload) => saveSection('education', { section: 'education', data: {}, education: payload })} />
          )}
          {active === 'employment' && (
            <EmploymentSection data={employment} locked={locked} saving={saving} onSave={(payload) => saveSection('employment', { section: 'employment', data: payload })} />
          )}
          {active === 'skills' && (
            <SkillsSection data={skills} saving={saving} onSave={(payload) => saveSection('skills', { section: 'skills', data: { skills: payload } })} />
          )}
          {active === 'documents' && <DocumentsSummary documents={documents} />}
          {active === 'assets' && (
            <AssetsSection assets={assets} setAssets={setAssets} locked={locked} saving={assetSaving} onSave={handleAssets} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={submitModal}
        title="Submit profile for verification?"
        message="The information submitted by you must be accurate and complete. Incorrect or false information may result in rejection of your employee verification. After submission, you will not be able to edit verified fields."
        confirmLabel="I AGREE & SUBMIT"
        onConfirm={submitProfile}
        onCancel={() => setSubmitModal(false)}
        loading={submitLoading}
      />
    </div>
  )
}

function PersonalSection({ data, employee, locked, saving, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    setForm({
      fatherName: data?.fatherName || '',
      motherName: data?.motherName || '',
      dateOfBirth: data?.dateOfBirth || employee?.dob || '',
      gender: data?.gender || '',
      bloodGroup: data?.bloodGroup || '',
      maritalStatus: data?.maritalStatus || '',
      nationality: data?.nationality || 'Indian',
      aadhaarNumber: data?.aadhaarNumber || employee?.aadhaar || '',
      panNumber: data?.panNumber || employee?.pan_number || '',
      passportNumber: data?.passportNumber || '',
      drivingLicence: data?.drivingLicence || '',
      uanNumber: data?.uanNumber || '',
      esicNumber: data?.esicNumber || '',
    })
  }, [data, employee])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <SectionCard icon="👤" title="SECTION 1 — Personal Information" subtitle={locked ? 'Locked while under verification' : 'Your personal identity details'}>
      <div className="detail-grid mb-16">
        <div className="detail-item"><div className="k">Employee ID</div><div className="v">{employee.employee_id}</div></div>
        <div className="detail-item"><div className="k">Full Name</div><div className="v">{employee.name}</div></div>
        <div className="detail-item"><div className="k">Designation</div><div className="v">{employee.designation || '—'}</div></div>
        <div className="detail-item"><div className="k">Department</div><div className="v">{employee.department || '—'}</div></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
        <div className="form-row">
          <Field field={{ name: 'fatherName', label: "Father's Name", type: 'text', required: true, disabled: locked }} value={form.fatherName} onChange={set} />
          <Field field={{ name: 'motherName', label: "Mother's Name", type: 'text', required: true, disabled: locked }} value={form.motherName} onChange={set} />
          <Field field={{ name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true, disabled: locked }} value={form.dateOfBirth} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'gender', label: 'Gender', type: 'select', required: true, disabled: locked, options: ['male', 'female', 'other'] }} value={form.gender} onChange={set} />
          <Field field={{ name: 'bloodGroup', label: 'Blood Group', type: 'select', disabled: locked, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }} value={form.bloodGroup} onChange={set} />
          <Field field={{ name: 'maritalStatus', label: 'Marital Status', type: 'select', disabled: locked, options: ['married', 'single'] }} value={form.maritalStatus} onChange={set} />
          <Field field={{ name: 'nationality', label: 'Nationality', type: 'text', disabled: locked }} value={form.nationality} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'aadhaarNumber', label: 'Aadhaar Number', type: 'text', required: true, maxLength: 12, disabled: locked, hint: '12-digit Aadhaar' }} value={form.aadhaarNumber} onChange={set} />
          <Field field={{ name: 'panNumber', label: 'PAN Number', type: 'text', required: true, maxLength: 10, disabled: locked, hint: 'e.g. ABCDE1234F' }} value={form.panNumber} onChange={set} />
          <Field field={{ name: 'passportNumber', label: 'Passport Number', type: 'text', disabled: locked }} value={form.passportNumber} onChange={set} />
          <Field field={{ name: 'drivingLicence', label: 'Driving Licence', type: 'select', disabled: locked, options: ['yes', 'no'] }} value={form.drivingLicence} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'uanNumber', label: 'UAN Number', type: 'text', disabled: locked }} value={form.uanNumber} onChange={set} />
          <Field field={{ name: 'esicNumber', label: 'ESIC Number', type: 'text', disabled: locked }} value={form.esicNumber} onChange={set} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={locked || saving}>{saving ? 'Saving...' : 'Save Section'}</button>
        </div>
      </form>
    </SectionCard>
  )
}

function ContactSection({ data, employee, locked, saving, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    setForm({
      mobileNumber: data?.mobileNumber || employee?.mobile || '',
      alternateMobile: data?.alternateMobile || '',
      personalEmail: data?.personalEmail || '',
      officialEmail: data?.officialEmail || employee?.email || '',
      currentAddress: data?.currentAddress || employee?.current_address || '',
      permanentAddress: data?.permanentAddress || employee?.permanent_address || '',
      emergencyContactName: data?.emergencyContactName || employee?.emergency_contact_name || '',
      emergencyRelation: data?.emergencyRelation || employee?.emergency_relation || '',
      emergencyContactNumber: data?.emergencyContactNumber || employee?.emergency_mobile || '',
      emergencyAddress: data?.emergencyAddress || '',
    })
  }, [data, employee])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <SectionCard icon="📞" title="SECTION 2 — Contact & Family Details" subtitle={locked ? 'Locked while under verification' : 'How we reach you and your emergency contact'}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
        <div className="form-row">
          <Field field={{ name: 'mobileNumber', label: 'Mobile Number', type: 'text', required: true, disabled: locked }} value={form.mobileNumber} onChange={set} />
          <Field field={{ name: 'alternateMobile', label: 'Alternate Mobile', type: 'text', disabled: locked }} value={form.alternateMobile} onChange={set} />
          <Field field={{ name: 'personalEmail', label: 'Personal Email', type: 'email', disabled: locked }} value={form.personalEmail} onChange={set} />
          <Field field={{ name: 'officialEmail', label: 'Official Email', type: 'email', disabled: locked }} value={form.officialEmail} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'currentAddress', label: 'Current Address', type: 'textarea', disabled: locked }} value={form.currentAddress} onChange={set} />
          <Field field={{ name: 'permanentAddress', label: 'Permanent Address', type: 'textarea', disabled: locked }} value={form.permanentAddress} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'emergencyContactName', label: 'Emergency Contact Name', type: 'text', required: true, disabled: locked }} value={form.emergencyContactName} onChange={set} />
          <Field field={{ name: 'emergencyRelation', label: 'Relationship', type: 'text', disabled: locked }} value={form.emergencyRelation} onChange={set} />
          <Field field={{ name: 'emergencyContactNumber', label: 'Emergency Contact Number', type: 'text', required: true, disabled: locked }} value={form.emergencyContactNumber} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'emergencyAddress', label: 'Emergency Address', type: 'textarea', disabled: locked }} value={form.emergencyAddress} onChange={set} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={locked || saving}>{saving ? 'Saving...' : 'Save Section'}</button>
        </div>
      </form>
    </SectionCard>
  )
}

function EducationSection({ data = [], locked, saving, onSave }) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    setRows((data || []).length ? data.map((e) => ({ qualification: e.qualification, institute: e.institute || '', year: e.year || '', percentage: e.percentage || '' })) : [{ qualification: '', institute: '', year: '', percentage: '' }])
  }, [data])

  const update = (i, k, v) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)))
  const addRow = () => setRows((r) => [...r, { qualification: '', institute: '', year: '', percentage: '' }])
  const removeRow = (i) => setRows((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r))

  return (
    <SectionCard icon="🎓" title="SECTION 3 — Education" subtitle="Add all your qualifications">
      <table className="table">
        <thead>
          <tr><th>Qualification</th><th>Institute</th><th>Year</th><th>% / CGPA</th>{!locked && <th></th>}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td><input className="input" value={row.qualification} onChange={(e) => update(i, 'qualification', e.target.value)} disabled={locked} placeholder="B.Tech, Diploma..." /></td>
              <td><input className="input" value={row.institute} onChange={(e) => update(i, 'institute', e.target.value)} disabled={locked} placeholder="Institute name" /></td>
              <td><input className="input" value={row.year} onChange={(e) => update(i, 'year', e.target.value)} disabled={locked} placeholder="2024" style={{ width: 100 }} /></td>
              <td><input className="input" value={row.percentage} onChange={(e) => update(i, 'percentage', e.target.value)} disabled={locked} placeholder="75%" style={{ width: 100 }} /></td>
              {!locked && (
                <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(i)}>✕</button></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <div className="mt-16 flex gap-12">
          <button type="button" className="btn btn-secondary" onClick={addRow}>+ Add Education</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => onSave(rows.filter((r) => r.qualification))}>
            {saving ? 'Saving...' : 'Save Section'}
          </button>
        </div>
      )}
    </SectionCard>
  )
}

function EmploymentSection({ data, locked, saving, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    setForm({
      previousCompany: data?.previousCompany || '',
      previousDesignation: data?.previousDesignation || '',
      experienceYears: data?.experienceYears || '',
      reasonForLeaving: data?.reasonForLeaving || '',
      lastSalary: data?.lastSalary || '',
      bankName: data?.bankName || '',
      branch: data?.branch || '',
      accountNumber: data?.accountNumber || '',
      ifscCode: data?.ifscCode || '',
      upiId: data?.upiId || '',
    })
  }, [data])
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <SectionCard icon="💼" title="SECTION 4 — Employment & Bank Details" subtitle="Previous employment and bank information (bank details are sensitive)">
      <form onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
        <div className="form-row">
          <Field field={{ name: 'previousCompany', label: 'Previous Company', type: 'text', disabled: locked }} value={form.previousCompany} onChange={set} />
          <Field field={{ name: 'previousDesignation', label: 'Designation', type: 'text', disabled: locked }} value={form.previousDesignation} onChange={set} />
          <Field field={{ name: 'experienceYears', label: 'Experience (years)', type: 'text', disabled: locked }} value={form.experienceYears} onChange={set} />
          <Field field={{ name: 'lastSalary', label: 'Last Salary (₹)', type: 'number', disabled: locked }} value={form.lastSalary} onChange={set} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'reasonForLeaving', label: 'Reason for Leaving', type: 'textarea', disabled: locked }} value={form.reasonForLeaving} onChange={set} />
        </div>
        <div className="form-section-title" style={{ marginTop: 8 }}>🏦 Bank Details</div>
        <div className="form-row">
          <Field field={{ name: 'bankName', label: 'Bank Name', type: 'text', required: true, disabled: locked }} value={form.bankName} onChange={set} />
          <Field field={{ name: 'branch', label: 'Branch', type: 'text', disabled: locked }} value={form.branch} onChange={set} />
          <Field field={{ name: 'accountNumber', label: 'Account Number', type: 'text', required: true, disabled: locked }} value={form.accountNumber} onChange={set} />
          <Field field={{ name: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, maxLength: 11, disabled: locked, hint: 'e.g. HDFC0001234' }} value={form.ifscCode} onChange={set} />
          <Field field={{ name: 'upiId', label: 'UPI ID', type: 'text', disabled: locked }} value={form.upiId} onChange={set} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={locked || saving}>{saving ? 'Saving...' : 'Save Section'}</button>
        </div>
      </form>
    </SectionCard>
  )
}

function SkillsSection({ data = [], saving, onSave }) {
  const [category, setCategory] = useState('it')
  const [skills, setSkills] = useState([])
  useEffect(() => {
    const all = (data || []).map((s) => ({ category: s.category, skill: s.skill }))
    const selected = all.filter((s) => s.category === category).map((s) => s.skill)
    setSkills(selected)
  }, [data, category])

  const options = category === 'it' ? IT_SKILLS : NON_IT_SKILLS

  const save = () => {
    const otherCategory = category === 'it' ? 'non_it' : 'it'
    const other = (data || []).filter((s) => s.category === otherCategory).map((s) => ({ category: s.category, skill: s.skill }))
    onSave([...other, ...skills.map((skill) => ({ category, skill }))])
  }

  return (
    <SectionCard icon="🛠️" title="SECTION 5 — Skills" subtitle="Select your skill category and all applicable skills">
      <div className="role-select mb-16" style={{ maxWidth: 340 }}>
        <button type="button" className={`role-option ${category === 'it' ? 'selected' : ''}`} onClick={() => setCategory('it')}>IT Skills</button>
        <button type="button" className={`role-option ${category === 'non_it' ? 'selected' : ''}`} onClick={() => setCategory('non_it')}>Non-IT Skills</button>
      </div>
      <ChipSelect options={options} selected={skills} onChange={setSkills} />
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Skills'}</button>
      </div>
    </SectionCard>
  )
}

function DocumentsSummary({ documents }) {
  return (
    <SectionCard icon="📁" title="SECTION 6 — Document Checklist" subtitle="Upload your documents in the Documents section">
      <p className="text-sm text-muted mb-16">
        Your documents are managed in the <Link to="/worker/documents"><strong>Documents</strong></Link> page.
        You must upload your Resume, Aadhaar, PAN, Photos, Bank Proof, Educational Certificates, Offer Letter, Employment Agreement, NDA, IP Assignment, Payivva Employee Information Form and Cyber Security Policies Letter before submitting your profile.
      </p>
      {documents.length === 0 ? (
        <Link to="/worker/documents" className="btn btn-primary">Go to Documents</Link>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm">{documents.length} document(s) uploaded · {documents.filter((d) => d.verificationStatus === 'approved').length} verified</span>
          <Link to="/worker/documents" className="btn btn-primary btn-sm">Manage Documents</Link>
        </div>
      )}
    </SectionCard>
  )
}

function AssetsSection({ assets, setAssets, locked, saving, onSave }) {
  return (
    <SectionCard icon="💻" title="SECTION 7 — Company Assets Issued" subtitle="Select all company assets issued to you">
      <ChipSelect options={ASSET_OPTIONS} selected={assets} onChange={setAssets} disabled={locked} />
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={locked || saving} onClick={onSave}>{saving ? 'Saving...' : 'Save Assets'}</button>
      </div>
    </SectionCard>
  )
}