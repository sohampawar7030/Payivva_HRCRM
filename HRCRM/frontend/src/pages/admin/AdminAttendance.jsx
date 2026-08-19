import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { formatTime, MONTHS } from '../../utils/format.js'

export default function AdminAttendance() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [workers, setWorkers] = useState(null)
  const [summaries, setSummaries] = useState({})
  const [today, setToday] = useState(null)

  useEffect(() => {
    api.get('/workers', { limit: 200 }).then((res) => {
      setWorkers(res.data.rows)
      Promise.all(res.data.rows.map((w) => api.get(`/attendance/employee/${w.id}`, { month, year }).then((r) => [w.id, r.data]).catch(() => [w.id, null])))
        .then((pairs) => setSummaries(Object.fromEntries(pairs)))
    }).catch(() => setWorkers([]))
    api.get('/attendance/today').then((res) => setToday(res.data.rows)).catch(() => setToday([]))
  }, [month, year])

  if (!workers || !today) return <LoadingPage label="Loading attendance..." />

  const sorted = [...workers].sort((a, b) => {
    const sa = summaries[a.id]
    const sb = summaries[b.id]
    return (sb?.presentDays || 0) - (sa?.presentDays || 0)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Attendance Overview</div>
          <div className="page-subtitle">Monthly summaries from the site attendance system (read-only). Days when a site is on hold are shown under "Hold" — not absent.</div>
        </div>
        <div className="flex items-center gap-8">
          <select className="input" style={{ width: 150 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-4 mb-16">
        <StatCard label="Checked In Today" value={today.length} icon="🕐" color="blue" />
        <StatCard label="Present Today" value={today.filter((a) => a.present).length} icon="✅" color="green" />
        <StatCard label="Late Today" value={today.filter((a) => a.isLate).length} icon="⏰" color="amber" />
      </div>

      <div className="card mb-16">
        <div className="card-header"><div className="card-title">Today's Check-ins</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {today.length === 0 && <EmptyState icon="🕐" title="No check-ins yet today" />}
          <table className="table">
            <thead><tr><th>Employee</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {today.map((a) => (
                <tr key={a.id}>
                  <td className="text-sm"><strong>{a.employeeName}</strong></td>
                  <td>{formatTime(a.checkIn)}</td>
                  <td>{formatTime(a.checkOut)}</td>
                  <td>{a.hours || '—'}</td>
                  <td>
                    {a.present && a.isLate
                      ? <StatusBadge status="late" labels={{ late: 'Late' }} />
                      : <StatusBadge status={a.present ? 'present' : 'absent'} labels={{ present: 'Present', absent: 'Absent' }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Monthly Summary — {MONTHS[month - 1]} {year}</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {sorted.length === 0 && <EmptyState icon="👥" title="No employees" />}
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Present</th><th>Absent</th><th>Hold</th><th>Leave/WFH</th><th>Half</th><th>Late</th><th>Hours</th></tr>
            </thead>
            <tbody>
              {sorted.map((w) => {
                const s = summaries[w.id]
                return (
                  <tr key={w.id}>
                    <td>
                      <Link to={`/admin/employees/${w.id}`} className="no-underline"><strong>{w.name}</strong></Link>
                      <div className="text-xs text-muted">{w.employee_id}</div>
                    </td>
                    <td>{s ? s.presentDays : '—'}</td>
                    <td>{s ? s.absentDays : '—'}</td>
                    <td>{s?.holdDays ? <StatusBadge status="hold" labels={{ hold: `${s.holdDays} days` }} /> : '—'}</td>
                    <td>{s ? s.leaveDays : '—'}</td>
                    <td>{s ? s.halfDays : '—'}</td>
                    <td>{s ? s.lateDays : '—'}</td>
                    <td>{s ? `${s.totalHours || 0} hrs` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}