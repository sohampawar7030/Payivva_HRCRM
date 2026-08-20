import { useEffect, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx'
import { Field } from '../../components/ui/Form.jsx'
import { formatDate, MONTHS } from '../../utils/format.js'
import { openFile } from '../../utils/files.js'

export default function AdminSalary() {
  const toast = useToast()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [rows, setRows] = useState(null)
  const [config, setConfig] = useState(null)
  const [statusData, setStatusData] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [configForm, setConfigForm] = useState({})
  const [finalizeTarget, setFinalizeTarget] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [calcTarget, setCalcTarget] = useState(null)
  const [calcResult, setCalcResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showSiteAnalysis, setShowSiteAnalysis] = useState(false)
  const [siteAnalysis, setSiteAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisCal, setAnalysisCal] = useState(null)

  const loadSiteAnalysis = () => {
    setAnalysisLoading(true)
    api.get('/salary/site-analysis', { month, year }).then((res) => setSiteAnalysis(res.data)).catch(() => setSiteAnalysis(null)).finally(() => setAnalysisLoading(false))
  }

  const load = () => {
    setRows(null)
    api.get('/salary/payrolls', { month, year, limit: 200 }).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [month, year])

  useEffect(() => {
    api.get('/salary/config').then((res) => setConfig(res.data.config)).catch(() => setConfig({}))
    api.get('/salary/status', { month, year }).then((res) => setStatusData(res.data)).catch(() => setStatusData({}))
  }, [month, year])

  const saveConfig = async () => {
    setLoading(true)
    try {
      await api.put('/salary/config', configForm)
      toast.success('Salary configuration saved')
      setShowConfig(false)
      setConfigForm({})
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const calculate = async () => {
    setLoading(true)
    try {
      const res = await api.post('/salary/calculate', { employeeId: calcTarget.employeeId, year, month })
      setCalcResult(res.data)
      setCalcTarget(null)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const calculateAll = async () => {
    setLoading(true)
    try {
      const res = await api.post('/salary/calculate-all', { year, month })
      toast.success(`Calculated payroll for ${res.data.processed} employees`)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const finalize = async () => {
    setLoading(true)
    try {
      await api.post(`/salary/${finalizeTarget.id}/finalize`)
      toast.success('Payroll finalized')
      setFinalizeTarget(null)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const saveEdit = async () => {
    setLoading(true)
    try {
      const payload = {
        basicSalary: num(editForm.basicSalary),
        hra: num(editForm.hra),
        da: num(editForm.da),
        allowances: num(editForm.allowances),
        overtimeAmount: num(editForm.overtimeAmount),
        absentDeduction: num(editForm.absentDeduction),
        lateDeduction: num(editForm.lateDeduction),
        pf: num(editForm.pf),
        esic: num(editForm.esic),
        professionalTax: num(editForm.professionalTax),
        otherDeductions: num(editForm.otherDeductions),
      }
      await api.put(`/salary/payrolls/${editTarget.id}`, payload)
      toast.success('Payroll amounts updated')
      setEditTarget(null)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (p) => {
    setEditTarget(p)
    setEditForm({
      basicSalary: Number(p.basicSalary) || 0,
      hra: Number(p.hra) || 0,
      da: Number(p.da) || 0,
      allowances: Number(p.allowances) || 0,
      overtimeAmount: Number(p.overtimeAmount) || 0,
      absentDeduction: Number(p.absentDeduction) || 0,
      lateDeduction: Number(p.lateDeduction) || 0,
      pf: Number(p.pf) || 0,
      esic: Number(p.esic) || 0,
      professionalTax: Number(p.professionalTax) || 0,
      otherDeductions: Number(p.otherDeductions) || 0,
    })
  }

  const num = (v) => Number(v) || 0
  const editGross = num(editForm.basicSalary) + num(editForm.hra) + num(editForm.da) + num(editForm.allowances) + num(editForm.overtimeAmount)
  const editDeductions = num(editForm.absentDeduction) + num(editForm.lateDeduction) + num(editForm.pf) + num(editForm.esic) + num(editForm.professionalTax) + num(editForm.otherDeductions)
  const editNet = Math.max(0, editGross - editDeductions)

  const genSlip = async (id) => {
    try {
      await api.post(`/salary/${id}/generate-slip`)
      toast.success('Salary slip generated')
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  const sendSlip = async (id) => {
    try {
      const res = await api.post(`/salary/${id}/send-slip`)
      toast.success(res.message || 'Salary slip emailed')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  const openSlip = (id) => openFile(`/salary/${id}/slip`)

  if (!rows || !config || !statusData) return <LoadingPage label="Loading payroll..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Salary Management</div>
          <div className="page-subtitle">Configurable payroll calculation, drafts, finalization and slips</div>
        </div>
        <div className="flex items-center gap-8">
          <select className="input" style={{ width: 150 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => { setConfigForm({}); setShowConfig(true) }}>Config</button>
          <button className={`btn ${showSiteAnalysis ? 'btn-success' : 'btn-secondary'}`} onClick={() => { if (!showSiteAnalysis && !siteAnalysis) loadSiteAnalysis(); setShowSiteAnalysis(!showSiteAnalysis) }}>🏗️ Site Wise Analysis</button>
          <button className="btn btn-primary" disabled={loading} onClick={calculateAll}>{loading ? 'Calculating...' : 'Calculate All'}</button>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        <StatCard label="Drafts" value={statusData.draft || 0} icon="📝" color="amber" />
        <StatCard label="Finalized" value={statusData.finalized || 0} icon="✅" color="blue" />
        <StatCard label="Paid" value={statusData.paid || 0} icon="💰" color="green" />
        <StatCard label="Work Days / Month" value={config.monthlyWorkDays || 26} icon="📅" color="purple" />
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Payroll — {MONTHS[month - 1]} {year}</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="💰" title="No payroll records" sub="Click 'Calculate All' to generate draft payrolls for this month." />}
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Present</th><th>Leave</th><th>Absent</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.employeeName}</strong>
                    <div className="text-xs text-muted">{p.employeeCode}</div>
                  </td>
                  <td>{p.presentDays}</td>
                  <td>{p.leaveDays}</td>
                  <td>{p.absentDays}</td>
                  <td>₹ {Number(p.grossSalary).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(p.totalDeductions).toLocaleString('en-IN')}</td>
                  <td><strong>₹ {Number(p.netSalary).toLocaleString('en-IN')}</strong></td>
                  <td><StatusBadge status={p.status} labels={{ draft: 'Draft', finalized: 'Finalized', paid: 'Paid' }} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetail(p)}>Details</button>
                    {p.status === 'draft' && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn btn-success btn-sm" onClick={() => setFinalizeTarget(p)}>Finalize</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setCalcTarget(p)}>Recalc</button>
                      </>
                    )}
                    {!p.slipGenerated && p.status !== 'draft' && <button className="btn btn-secondary btn-sm" onClick={() => genSlip(p.id)}>Gen Slip</button>}
                    {p.slipGenerated && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => openSlip(p.id)}>Slip</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => sendSlip(p.id)}>Email</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSiteAnalysis && (
        <div className="card mt-16">
          <div className="card-header">
            <div className="card-title">🏗️ Site Wise Analysis — {MONTHS[month - 1]} {year}</div>
            <div className="flex items-center gap-8">
              <span className="text-xs text-muted">Which worker was present at which site for how many days — holding days are shown for workers with no site assigned (click Calendar for the date-wise view).</span>
              <button className="btn btn-secondary btn-sm" disabled={analysisLoading} onClick={loadSiteAnalysis}>{analysisLoading ? 'Loading...' : 'Refresh'}</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {analysisLoading && <div className="p-16 text-sm text-muted">Loading site analysis...</div>}
            {!analysisLoading && !siteAnalysis && <div className="p-16 text-sm text-muted">Could not load site analysis.</div>}
            {!analysisLoading && siteAnalysis && siteAnalysis.employees.length === 0 && <EmptyState icon="🏗️" title="No attendance found" sub="No present days recorded for this month." />}
            {!analysisLoading && siteAnalysis && siteAnalysis.employees.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Total Present</th>
                      <th>Leave Days</th>
                      <th>Holding Days</th>
                      {siteAnalysis.employees.flatMap((e) => e.sites).reduce((acc, s) => (acc.find((x) => x.siteId === s.siteId) ? acc : [...acc, s]), []).map((s) => (
                        <th key={s.siteId}>{s.siteName}</th>
                      ))}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteAnalysis.employees.map((e) => (
                      <tr key={e.employeeId}>
                        <td>
                          <strong>{e.name}</strong>
                          <div className="text-xs text-muted">{e.employee_id}</div>
                        </td>
                        <td><strong>{e.totalDays}</strong></td>
                        <td>
                          {e.leaveDays > 0 ? (
                            <span className="badge badge-amber" title="Approved leaves (IT + Director)">🌴 {e.leaveDays}</span>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td>
                          {e.unassignedDays > 0 ? (
                            <span className="badge badge-amber" title="Days with no site assigned — not absent, salary continues">{e.unassignedDays}</span>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                        {siteAnalysis.employees.flatMap((x) => x.sites).reduce((acc, s) => (acc.find((x) => x.siteId === s.siteId) ? acc : [...acc, s]), []).map((s) => {
                          const st = e.sites.find((x) => x.siteId === s.siteId)
                          return <td key={s.siteId} style={{ fontWeight: st ? 600 : 400 }}>{st ? st.days : '—'}</td>
                        })}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAnalysisCal(e)}>📅 Calendar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={!!analysisCal} onClose={() => setAnalysisCal(null)} title={`Site Calendar — ${analysisCal?.name}`} wide>
        {analysisCal && (
          <SiteCalendarView employee={analysisCal} calendar={siteAnalysis?.calendar || []} month={month} year={year} />
        )}
      </Modal>

      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="Salary Calculation Configuration" wide>
        <p className="text-sm text-muted mb-16">These rules drive the payroll calculation for all employees. Leave blank to keep current values.</p>
        <div className="form-row">
          <Field field={{ name: 'monthlyWorkDays', label: 'Work Days per Month', type: 'number' }} value={configForm.monthlyWorkDays} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'basicPercent', label: 'Basic %', type: 'number' }} value={configForm.basicPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'hraPercent', label: 'HRA %', type: 'number' }} value={configForm.hraPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'daPercent', label: 'DA %', type: 'number' }} value={configForm.daPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'absentDeductionPercent', label: 'Absent Deduction %', type: 'number' }} value={configForm.absentDeductionPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'halfDayDeductionPercent', label: 'Half-Day Deduction %', type: 'number' }} value={configForm.halfDayDeductionPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'pfPercent', label: 'PF %', type: 'number' }} value={configForm.pfPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'esicPercent', label: 'ESIC %', type: 'number' }} value={configForm.esicPercent} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'professionalTaxAmount', label: 'Professional Tax (₹)', type: 'number' }} value={configForm.professionalTaxAmount} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'lateDeductionAmount', label: 'Late Deduction (₹/day)', type: 'number' }} value={configForm.lateDeductionAmount} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'overtimeRatePerHour', label: 'Overtime Rate (₹/hr)', type: 'number' }} value={configForm.overtimeRatePerHour} onChange={(k, v) => setConfigForm((f) => ({ ...f, [k]: v }))} />
        </div>
        <div className="form-row">
          <div className="field">
            <label className="checkbox"><input type="checkbox" checked={configForm.includePf !== undefined ? configForm.includePf : config.includePf === 'true'} onChange={(e) => setConfigForm((f) => ({ ...f, includePf: String(e.target.checked) }))} /> Include PF</label>
          </div>
          <div className="field">
            <label className="checkbox"><input type="checkbox" checked={configForm.includeEsic !== undefined ? configForm.includeEsic : config.includeEsic === 'true'} onChange={(e) => setConfigForm((f) => ({ ...f, includeEsic: String(e.target.checked) }))} /> Include ESIC (≤ ₹21,000)</label>
          </div>
          <div className="field">
            <label className="checkbox"><input type="checkbox" checked={configForm.allowOvertime !== undefined ? configForm.allowOvertime : config.allowOvertime === 'true'} onChange={(e) => setConfigForm((f) => ({ ...f, allowOvertime: String(e.target.checked) }))} /> Allow Overtime</label>
          </div>
          <div className="field">
            <label className="checkbox"><input type="checkbox" checked={configForm.allowLateDeduction !== undefined ? configForm.allowLateDeduction : config.allowLateDeduction === 'true'} onChange={(e) => setConfigForm((f) => ({ ...f, allowLateDeduction: String(e.target.checked) }))} /> Late Deductions</label>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setShowConfig(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={loading} onClick={saveConfig}>{loading ? 'Saving...' : 'Save Configuration'}</button>
        </div>
      </Modal>

      <Modal open={!!calcTarget} onClose={() => setCalcTarget(null)} title="Recalculate Payroll">
        <p className="text-sm text-muted mb-16">Recalculate draft payroll for <strong>{calcTarget?.employeeName}</strong> for {MONTHS[month - 1]} {year}?</p>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setCalcTarget(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={loading} onClick={calculate}>{loading ? 'Calculating...' : 'Calculate'}</button>
        </div>
      </Modal>

      <Modal open={!!calcResult} onClose={() => setCalcResult(null)} title="Payroll Calculated">
        {calcResult && (
          <div className="detail-stack">
            <div className="detail-item"><div className="k">Employee</div><div className="v">{calcResult.employee?.name}</div></div>
            <div className="detail-item"><div className="k">Gross Salary</div><div className="v">₹ {Number(calcResult.grossSalary).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">Total Deductions</div><div className="v">₹ {Number(calcResult.totalDeductions).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">Net Salary</div><div className="v"><strong>₹ {Number(calcResult.netSalary).toLocaleString('en-IN')}</strong></div></div>
            <div className="detail-item"><div className="k">Present / Leave / Absent</div><div className="v">{calcResult.presentDays} / {calcResult.leaveDays} / {calcResult.absentDays}</div></div>
          </div>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => setCalcResult(null)}>Close</button>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Payroll Amounts" wide>
        <p className="text-sm text-muted mb-16">Manually adjust <strong>{editTarget?.employeeName}</strong>'s {MONTHS[editTarget?.month - 1]} {editTarget?.year} payroll. Gross and Net are recalculated automatically. Changes appear immediately in the worker's Salary page.</p>
        <div className="form-row">
          <Field field={{ name: 'basicSalary', label: 'Basic (₹)', type: 'number' }} value={editForm.basicSalary} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'hra', label: 'HRA (₹)', type: 'number' }} value={editForm.hra} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'da', label: 'DA (₹)', type: 'number' }} value={editForm.da} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'allowances', label: 'Allowances (₹)', type: 'number' }} value={editForm.allowances} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'overtimeAmount', label: 'Overtime Amount (₹)', type: 'number' }} value={editForm.overtimeAmount} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'absentDeduction', label: 'Absent Deduction (₹)', type: 'number' }} value={editForm.absentDeduction} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'lateDeduction', label: 'Late Deduction (₹)', type: 'number' }} value={editForm.lateDeduction} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
        </div>
        <div className="form-row">
          <Field field={{ name: 'pf', label: 'PF (₹)', type: 'number' }} value={editForm.pf} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'esic', label: 'ESIC (₹)', type: 'number' }} value={editForm.esic} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'professionalTax', label: 'Professional Tax (₹)', type: 'number' }} value={editForm.professionalTax} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
          <Field field={{ name: 'otherDeductions', label: 'Other Deductions (₹)', type: 'number' }} value={editForm.otherDeductions} onChange={(k, v) => setEditForm((f) => ({ ...f, [k]: v }))} />
        </div>
        <div className="detail-stack" style={{ marginTop: 12 }}>
          <div className="detail-item"><div className="k">Gross Salary</div><div className="v">₹ {editGross.toLocaleString('en-IN')}</div></div>
          <div className="detail-item"><div className="k">Total Deductions</div><div className="v">₹ {editDeductions.toLocaleString('en-IN')}</div></div>
          <div className="detail-item"><div className="k">Net Salary</div><div className="v"><strong>₹ {editNet.toLocaleString('en-IN')}</strong></div></div>
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={loading} onClick={saveEdit}>{loading ? 'Saving...' : 'Save Amounts'}</button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Payroll Details">
        {detail && (
          <div className="detail-stack">
            <div className="detail-item"><div className="k">Employee</div><div className="v">{detail.employeeName} ({detail.employeeCode})</div></div>
            <div className="detail-item"><div className="k">Month</div><div className="v">{MONTHS[detail.month - 1]} {detail.year}</div></div>
            <div className="detail-item"><div className="k">Basic</div><div className="v">₹ {Number(detail.basicSalary).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">HRA</div><div className="v">₹ {Number(detail.hra).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">DA</div><div className="v">₹ {Number(detail.da).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">Allowances</div><div className="v">₹ {Number(detail.allowances).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">Present / Leave / Absent</div><div className="v">{detail.presentDays} / {detail.leaveDays} / {detail.absentDays}</div></div>
            <div className="detail-item"><div className="k">Half-Day / WFH / Late</div><div className="v">{detail.halfDays} / {detail.wfhDays} / {detail.lateDays}</div></div>
            <div className="detail-item"><div className="k">Overtime</div><div className="v">₹ {Number(detail.overtimeAmount).toLocaleString('en-IN')} ({detail.overtimeMinutes} min)</div></div>
            <div className="detail-item"><div className="k">Absent Deduction</div><div className="v">₹ {Number(detail.absentDeduction).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">Late Deduction</div><div className="v">₹ {Number(detail.lateDeduction).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">PF / ESIC / PT</div><div className="v">₹ {Number(detail.pf).toLocaleString('en-IN')} / ₹ {Number(detail.esic).toLocaleString('en-IN')} / ₹ {Number(detail.professionalTax).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><div className="k">Net Salary</div><div className="v"><strong>₹ {Number(detail.netSalary).toLocaleString('en-IN')}</strong></div></div>
            <div className="detail-item"><div className="k">Calculated</div><div className="v">{formatDate(detail.calculatedAt)}</div></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!finalizeTarget}
        title="Finalize this payroll?"
        message={`Finalizing ${finalizeTarget?.employeeName}'s payroll locks the amounts. Generate and email the salary slip afterwards.`}
        confirmLabel="Finalize Payroll"
        onConfirm={finalize}
        onCancel={() => setFinalizeTarget(null)}
        loading={loading}
      />
    </div>
  )
}

const SITE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#059669']
const siteColor = (siteId) => SITE_COLORS[(String(siteId).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % SITE_COLORS.length]

function SiteCalendarView({ employee, calendar, month, year }) {
  const myDays = calendar.filter((c) => c.employeeId === employee.employeeId)
  const byDate = {}
  for (const c of myDays) byDate[c.date] = c
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${ym}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, worked: byDate[key] })
  }
  return (
    <div>
      <div className="chip-row mb-16">
        {employee.unassignedDays > 0 && (
          <span className="chip" style={{ borderColor: 'var(--gray-300)' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--gray-300)', marginRight: 6 }} />
            No site assigned (holding) — {employee.unassignedDays} day{employee.unassignedDays > 1 ? 's' : ''}
          </span>
        )}
        {employee.leaveDays > 0 && (
          <span className="chip" style={{ borderColor: 'var(--amber-300, #fcd34d)' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#f59e0b', marginRight: 6 }} />
            🌴 On leave — {employee.leaveDays} day{employee.leaveDays > 1 ? 's' : ''}
          </span>
        )}
        {employee.sites.map((s) => (
          <span key={s.siteId} className="chip" style={{ borderColor: siteColor(s.siteId) }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: siteColor(s.siteId), marginRight: 6 }} />
            {s.siteName} — {s.days} day{s.days > 1 ? 's' : ''}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 11 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
          <div key={wd} className="text-muted text-center py-4">{wd}</div>
        ))}
        {cells.map((cell, i) => (
          <div key={i}
            className="text-center"
            style={{
              minHeight: 48, borderRadius: 6, padding: 3,
              border: '1px solid var(--gray-100)',
              background: cell && cell.worked ? (cell.worked.siteId === 0 ? 'rgba(107,114,128,0.15)' : cell.worked.siteId === -1 ? 'rgba(245,158,11,0.15)' : (siteColor(cell.worked.siteId) + '22')) : 'transparent',
              color: cell && cell.worked ? 'var(--text)' : 'var(--gray-400)',
              fontWeight: cell && cell.worked ? 600 : 400,
            }}
          >
            {cell && (
              <>
                <div>{cell.day}</div>
                {cell.worked && (
                  <div style={{ color: cell.worked.siteId === 0 ? 'var(--gray-500)' : cell.worked.siteId === -1 ? '#d97706' : siteColor(cell.worked.siteId), fontSize: 9, lineHeight: 1.1, wordBreak: 'break-word' }}>{cell.worked.siteName}</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-16 text-xs text-muted">Which site the worker was present at on each day — gray = no site assigned (holding), amber = on approved leave, colored = worked.</div>
    </div>
  )
}