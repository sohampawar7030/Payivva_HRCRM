import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { LoadingPage } from '../../components/ui/Feedback.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { MONTHS, formatTime } from '../../utils/format.js'

export default function WorkerAttendance() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    api.get('/attendance/mine', { year, month }).then((res) => setData(res.data)).catch(() => setData(null))
  }, [month, year])

  const statusLabel = (d) => {
    if (d.status === 'Present') return 'Present'
    if (d.status === 'Denied') return 'Denied'
    if (d.isWeekend) return 'Weekend'
    if (d.isHoliday) return 'Holiday'
    if (d.isLeave) return d.leaveType ? `${d.leaveType.replace('_', ' ')} leave` : 'On leave'
    if (d.isHalfDay) return 'Half day'
    if (d.isUnassigned) return 'No site assigned (holding)'
    if (d.isSiteHold) return 'Site on hold'
    return 'Absent'
  }

  if (!data) return <LoadingPage label="Loading attendance..." />

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My Attendance</div>
          <div className="page-subtitle">Daily records from the site attendance system (read-only)</div>
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

      <div className="grid mb-16" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard label="Present" value={data.presentDays} icon="✅" color="green" />
        <StatCard label="Absent" value={data.absentDays} icon="❌" color="red" />
        <StatCard label="On Hold" value={(data.holdDays || 0) + (data.unassignedDays || 0)} sub={data.unassignedDays > 0 ? `No site assigned (${data.unassignedDays} days)` : 'Site work stopped'} icon="⏸️" color="amber" />
        <StatCard label="Leave / WFH" value={data.leaveDays} icon="🌴" color="purple" />
        <StatCard label="Total Hours" value={data.totalHours ? `${data.totalHours} hrs` : '—'} sub={`${data.lateDays || 0} late check-ins`} icon="🕐" color="blue" />
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Daily Records — {MONTHS[month - 1]} {year}</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Shift</th></tr>
            </thead>
            <tbody>
              {data.attendanceRows.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td><StatusBadge status={statusLabel(d)} /></td>
                  <td>{formatTime(d.checkIn)}</td>
                  <td>{formatTime(d.checkOut)}</td>
                  <td>{d.hours}</td>
                  <td className="text-sm text-muted">{d.shiftName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}