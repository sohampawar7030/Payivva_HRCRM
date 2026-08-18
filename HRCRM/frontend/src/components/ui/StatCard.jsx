export function StatCard({ label, value, sub, icon, color = 'blue' }) {
  const colors = {
    blue: { bg: 'var(--accent-light)', fg: 'var(--accent)' },
    green: { bg: 'var(--success-light)', fg: 'var(--success)' },
    amber: { bg: 'var(--warning-light)', fg: 'var(--warning)' },
    red: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
    purple: { bg: 'var(--purple-light)', fg: 'var(--purple)' },
    cyan: { bg: 'var(--info-light)', fg: 'var(--info)' },
    gray: { bg: 'var(--gray-100)', fg: 'var(--gray-600)' },
  }
  const c = colors[color] || colors.blue
  return (
    <div className="stat-card">
      {icon && (
        <div className="stat-icon" style={{ background: c.bg, color: c.fg }}>
          {icon}
        </div>
      )}
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  )
}

export function ProgressBar({ percent, warn = false }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={p} aria-valuemin="0" aria-valuemax="100">
      <div className={`progress-fill ${warn ? 'warn' : ''}`} style={{ width: `${p}%` }} />
    </div>
  )
}

export function Avatar({ name, size = 34 }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span className="user-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || '?'}
    </span>
  )
}