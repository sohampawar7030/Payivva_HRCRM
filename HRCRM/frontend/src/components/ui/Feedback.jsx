export function Spinner({ size = 'md' }) {
  return <span className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} aria-label="Loading" />
}

export function LoadingPage({ label = 'Loading...' }) {
  return (
    <div className="loading-page flex-col items-center gap-12">
      <Spinner size="lg" />
      <span className="text-muted text-sm">{label}</span>
    </div>
  )
}

export function Skeleton({ width = '100%', height = 16, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} height={18} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', sub = 'Data will appear here once available.', icon = '📭' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  )
}