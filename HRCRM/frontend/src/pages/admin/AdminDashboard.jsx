import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { LoadingPage } from '../../components/ui/Feedback.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { formatDate, formatTime } from '../../utils/format.js'

export default function AdminDashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/dashboard/admin').then((res) => setData(res.data)).catch(() => setData(null))
  }, [])

  if (!data) return <LoadingPage label="Loading dashboard..." />

  const { stats, todayAttendance, recentEmployees, upcomingBirthdays, recentActivities } = data

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Director Dashboard</div>
          <div className="page-subtitle">Company-wide HR overview</div>
        </div>
        <Link to="/admin/salary" className="btn btn-primary">Manage Payroll</Link>
      </div>

      <div className="grid grid-4 mb-16">
        <StatCard label="Total Employees" value={stats.totalEmployees} sub={`${stats.activeEmployees} active`} icon="👥" color="blue" />
        <StatCard label="Fully Verified" value={stats.fullyVerified} sub={`${stats.incompleteProfiles} incomplete`} icon="✅" color="green" />
        <StatCard label="Pending Verifications" value={stats.pendingVerifications} icon="📝" color="amber" />
        <StatCard label="Pending Leaves" value={stats.pendingLeaves} icon="🌴" color="purple" />
      </div>

      <div className="grid mb-16" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard label="Checked In Today" value={stats.todayCheckedIn} icon="🕐" color="cyan" />
        <StatCard label="Present Today" value={stats.todayPresent} icon="✅" color="green" />
        <StatCard label="Monthly Checked In" value={stats.monthlyCheckedIn} sub={`${stats.monthlyNotCheckedIn} not checked in`} icon="📅" color="blue" />
        <StatCard label="Sites On Hold" value={stats.sitesOnHold} sub="Attendance paused" icon="⏸️" color="red" />
        <StatCard label={`Payroll ${stats.payroll.month}/${stats.payroll.year}`} value={`${stats.payroll.draft} drafts`} sub={`${stats.payroll.finalized} finalized · ${stats.payroll.paid} paid`} icon="💰" color="green" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Employees</div>
            <Link to="/admin/employees" className="btn btn-secondary btn-sm">All Employees</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Name</th><th>Employee ID</th><th>Department</th><th>Joined</th></tr></thead>
              <tbody>
                {recentEmployees.map((e) => (
                  <tr key={e.id}>
                    <td><Link to={`/admin/employees/${e.id}`} className="no-underline"><strong>{e.name}</strong></Link></td>
                    <td className="text-sm">{e.employee_id}</td>
                    <td className="text-sm">{e.department || '—'}</td>
                    <td className="text-sm">{formatDate(e.joining_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Today's Attendance</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {todayAttendance.length === 0 && <div className="p-16 text-sm text-muted">No check-ins recorded yet today.</div>}
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
          <div className="card-header"><div className="card-title">Recent Activity</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentActivities.map((l, i) => (
              <div key={i} className="flex items-center justify-between" style={{ padding: '10px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                <div>
                  <div className="text-sm"><strong>{l.actorName || 'System'}</strong> <span className="text-muted">· {l.module}</span></div>
                  <div className="text-xs text-muted">{l.description}</div>
                </div>
                <code className="text-xs">{l.action}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Upcoming Birthdays</div></div>
          <div className="card-body" style={{ padding: 0 }}>
            {upcomingBirthdays.length === 0 && <div className="p-16 text-sm text-muted">No birthdays on record.</div>}
            {upcomingBirthdays.map((e) => (
              <div key={e.id} className="flex items-center justify-between" style={{ padding: '10px 18px', borderBottom: '1px solid var(--gray-100)' }}>
                <div className="text-sm"><strong>{e.name}</strong></div>
                <div className="text-sm">{formatDate(e.dob)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}