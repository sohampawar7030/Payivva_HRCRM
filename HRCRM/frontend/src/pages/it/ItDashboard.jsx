import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { LoadingPage } from '../../components/ui/Feedback.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { timeAgo, formatTime } from '../../utils/format.js'
import { DOCUMENT_TYPES, EMAIL_CATEGORIES } from '../../../../shared/constants.js'

export default function ItDashboard() {
  const [data, setData] = useState(null)
  const [sites, setSites] = useState([])

  useEffect(() => {
    api.get('/dashboard/it').then((res) => setData(res.data)).catch(() => setData(null))
    api.get('/sites').then((res) => setSites(res.data.rows)).catch(() => setSites([]))
  }, [])

  if (!data) return <LoadingPage label="Loading IT dashboard..." />

  const { stats, todayAttendance, recentRegistrations, recentDocs, emailActivity } = data
  const holdSites = sites.filter((s) => s.status === 'on_hold')

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">IT Dashboard</div>
          <div className="page-subtitle">Manage workers, verifications, documents and communications</div>
        </div>
        <Link to="/it/workers" className="btn btn-primary">+ Register Worker</Link>
      </div>

      <div className="grid grid-4 mb-16">
        <Link to="/it/workers" className="no-underline">
          <StatCard label="Total Employees" value={stats.totalEmployees} icon="👥" color="blue" />
        </Link>
        <Link to="/it/verification" className="no-underline">
          <StatCard label="Pending Profile Verifications" value={stats.pendingProfiles} icon="📝" color="amber" />
        </Link>
        <Link to="/it/verification" className="no-underline">
          <StatCard label="Pending Document Verifications" value={stats.pendingDocs} icon="📁" color="cyan" />
        </Link>
        <Link to="/it/leaves" className="no-underline">
          <StatCard label="Pending Leave Requests" value={stats.pendingLeaves} icon="🌴" color="purple" />
        </Link>
      </div>

      <div className="grid grid-4 mb-16">
        <StatCard label="Pending Onboarding" value={stats.pendingRegistrations} icon="🚀" color="green" />
        <StatCard label="Checked In Today" value={stats.todayCheckedIn} icon="🕐" color="blue" />
        <StatCard label="Present Today" value={stats.todayPresent} icon="✅" color="green" />
        <StatCard label="Sites On Hold" value={holdSites.length} sub={holdSites.map((s) => s.site_name).join(', ') || 'All sites running'} icon="⏸️" color="red" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Registrations</div>
            <Link to="/it/workers" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Name</th><th>Employee ID</th><th>Account</th></tr></thead>
              <tbody>
                {recentRegistrations.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/it/workers/${e.id}`} className="no-underline"><strong>{e.name}</strong></Link>
                      <div className="text-xs text-muted">{e.designation || '—'}</div>
                    </td>
                    <td className="text-sm">{e.employee_id}</td>
                    <td><StatusBadge status={e.accountStatus || 'no_account'} labels={{ pending_onboarding: 'Pending Onboarding', active: 'Active', disabled: 'Disabled', no_account: 'No Account' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Document Uploads</div>
            <Link to="/it/verification" className="btn btn-secondary btn-sm">Verify Documents</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Document</th><th>Employee</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {recentDocs.map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm">{DOCUMENT_TYPES[d.docType]?.label || d.docType}</td>
                    <td className="text-sm">{d.employeeName}</td>
                    <td><StatusBadge status={d.verificationStatus} /></td>
                    <td className="text-xs text-muted">{timeAgo(d.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Today's Attendance</div>
            <Link to="/it/workers" className="btn btn-secondary btn-sm">Workers</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {todayAttendance.length === 0 && <div className="text-sm text-muted p-16">No check-ins recorded yet today.</div>}
            <table className="table">
              <thead><tr><th>Employee</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead>
              <tbody>
                {todayAttendance.map((a) => (
                  <tr key={a.id}>
                    <td className="text-sm">{a.employeeName}</td>
                    <td>{formatTime(a.checkIn)}</td>
                    <td>{formatTime(a.checkOut)}</td>
                    <td><StatusBadge status={a.present ? 'present' : 'absent'} labels={{ present: 'Present', absent: 'Absent' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Email Activity</div>
            <Link to="/it/emails" className="btn btn-secondary btn-sm">Send Email</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Category</th><th>Status</th><th>Count</th></tr></thead>
              <tbody>
                {emailActivity.map((e, i) => (
                  <tr key={i}>
                    <td className="text-sm">{EMAIL_CATEGORIES.includes(e.category) ? e.category.replace(/_/g, ' ') : e.category}</td>
                    <td><StatusBadge status={e.status} labels={{ sent: 'Sent', failed: 'Failed' }} /></td>
                    <td>{e.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}