import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { EmptyState, LoadingPage } from '../components/ui/Feedback.jsx'
import { timeAgo } from '../utils/format.js'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.get('/notifications', { limit: 100 })
      .then((res) => setNotifications(res.data.rows))
      .catch(() => setNotifications([]))
  }, [])

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)))
  }

  if (!notifications) return <LoadingPage />

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => (filter === 'unread' ? !n.isRead : n.isRead))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Notifications</div>
          <div className="page-subtitle">Updates about your profile, leaves, documents and more</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread</button>
        <button className={`tab ${filter === 'read' ? 'active' : ''}`} onClick={() => setFilter('read')}>Read</button>
      </div>

      {filtered.length === 0 && <div className="card"><EmptyState icon="🔕" title="No notifications" sub="You are all caught up." /></div>}

      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((n) => (
          <div key={n.id} className={`card card-pad ${n.isRead ? '' : ''}`} style={{ borderLeft: `4px solid var(--${n.isRead ? 'gray-200' : 'accent'})`, cursor: 'pointer' }} onClick={() => !n.isRead && markRead(n.id)}>
            <div className="flex items-center justify-between">
              <strong>{n.title} {!n.isRead && <span className="badge badge-blue">New</span>}</strong>
              <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
            </div>
            <div className="text-sm mt-8" style={{ color: 'var(--gray-600)' }}>{n.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}