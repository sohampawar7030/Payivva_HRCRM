import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import { StatCard, ProgressBar } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { formatDate, timeAgo } from '../../utils/format.js'
import { LEAVE_TYPE_LABELS } from '../../../../shared/constants.js'

export default function WorkerDashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/dashboard/worker').then((res) => setData(res.data)).catch(() => setData(null))
  }, [])

  if (!data) return <LoadingPage label="Loading your dashboard..." />

  const { profileCompletion, verification, leaveBalances, leaveRequests, attendance, payroll, letters, documents, upcomingLeaves, canEdit } = data
  const status = verification?.profileStatus || 'not_started'

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Worker Dashboard</div>
          <div className="page-subtitle">Welcome back! Here is your HR overview.</div>
        </div>
        <Link to="/worker/profile" className="btn btn-primary">Complete / View Profile</Link>
      </div>

      {profileCompletion.percent < 100 && (
        <div className="card-pad mb-16" style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 10 }}>
          <strong className="text-warning">⚠ Your employee profile is incomplete ({profileCompletion.percent}%).</strong>
          <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>Please complete all required information so your verification can proceed.</div>
        </div>
      )}

      <div className="grid grid-4 mb-16">
        <StatCard label="Profile Completion" value={`${profileCompletion.percent}%`} icon="📝" color={profileCompletion.percent === 100 ? 'green' : 'amber'} />
        <StatCard label="Verification Status" value={<StatusBadge status={status} />} icon="✅" color={status === 'fully_verified' ? 'green' : 'blue'} />
        <StatCard label="Pending Documents" value={documents.filter((d) => d.verificationStatus === 'pending').length} icon="📁" color="cyan" />
        <StatCard label="This Month" value={`${attendance.presentDays}D`} sub={`${attendance.absentDays} absent · ${attendance.leaveDays} leave`} icon="🕐" color="purple" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Profile Progress</div>
          </div>
          <div className="card-body">
            <div className="flex items-center justify-between mb-8">
              <span className="font-semibold">{profileCompletion.percent}% complete</span>
              {canEdit ? <span className="badge badge-blue">Editable</span> : <span className="badge badge-gray">Locked (under verification)</span>}
            </div>
            <ProgressBar percent={profileCompletion.percent} />
            <div className="mt-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {profileCompletion.sections.map((s) => (
                <div key={s.key} className={`check-item ${s.done ? 'done' : 'pending'}`}>
                  <span className={`check-icon ${s.done ? 'done' : 'pending'}`}>{s.done ? '✓' : '•'}</span>
                  <span className="text-sm">{s.key[0].toUpperCase() + s.key.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Leave Balance ({new Date().getFullYear()})</div>
            <Link to="/worker/leaves" className="btn btn-secondary btn-sm">Apply Leave</Link>
          </div>
          <div className="card-body">
            <table className="summary-table">
              <tbody>
                {leaveBalances.map((b) => (
                  <tr key={b.leaveType}>
                    <td>{LEAVE_TYPE_LABELS[b.leaveType]}</td>
                    <td>{Number(b.used)} / {Number(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Leave Requests</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {leaveRequests.length === 0 && <EmptyState icon="🌴" title="No leave requests" sub="Apply for leave from the Leave Management page." />}
            {leaveRequests.map((l) => (
              <div key={l.id} className="flex items-center justify-between" style={{ padding: '12px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <div className="font-semibold text-sm">{LEAVE_TYPE_LABELS[l.leaveType]} · {Number(l.days)} day(s)</div>
                  <div className="text-xs text-muted">{formatDate(l.startDate)} → {formatDate(l.endDate)}</div>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Documents</div>
            <Link to="/worker/documents" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {documents.length === 0 && <EmptyState icon="📁" title="No documents" sub="Upload your documents from the Documents page." />}
            {documents.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between" style={{ padding: '12px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <div className="font-semibold text-sm">{d.originalName}</div>
                  <div className="text-xs text-muted">v{d.version} · {timeAgo(d.uploadedAt)}</div>
                </div>
                <StatusBadge status={d.verificationStatus} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">My Salary</div>
            <Link to="/worker/salary" className="btn btn-secondary btn-sm">Details</Link>
          </div>
          <div className="card-body">
            {payroll ? (
              <table className="summary-table">
                <tbody>
                  <tr><td>Gross Salary</td><td>₹ {Number(payroll.grossSalary).toLocaleString('en-IN')}</td></tr>
                  <tr><td>Total Deductions</td><td>₹ {Number(payroll.totalDeductions).toLocaleString('en-IN')}</td></tr>
                  <tr className="total"><td>Net Salary</td><td>₹ {Number(payroll.netSalary).toLocaleString('en-IN')}</td></tr>
                  <tr><td>Status</td><td><StatusBadge status={payroll.status} /></td></tr>
                </tbody>
              </table>
            ) : (
              <EmptyState icon="💰" title="No salary record yet" sub="Salary for this month has not been processed yet." />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Company Letters</div>
            <Link to="/worker/letters" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {letters.length === 0 && <EmptyState icon="📄" title="No letters yet" sub="Offer / joining letters will appear here." />}
            {letters.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between" style={{ padding: '12px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <div className="font-semibold text-sm">{l.title}</div>
                  <div className="text-xs text-muted">v{l.version} · {timeAgo(l.generatedAt)}</div>
                </div>
                <StatusBadge status={l.status} labels={{ generated: 'Generated', sent: 'Sent' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {upcomingLeaves.length > 0 && (
        <div className="card card-pad mt-16" style={{ borderLeft: '4px solid var(--success)' }}>
          <strong>Upcoming approved leave:</strong>{' '}
          {upcomingLeaves.map((l) => `${LEAVE_TYPE_LABELS[l.leaveType]} (${formatDate(l.startDate)} → ${formatDate(l.endDate)})`).join(', ')}
        </div>
      )}
    </div>
  )
}