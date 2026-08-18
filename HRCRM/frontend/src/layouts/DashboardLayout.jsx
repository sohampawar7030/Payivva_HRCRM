import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import { Avatar } from '../components/ui/StatCard.jsx'
import { timeAgo } from '../utils/format.js'
import { ROLE_LABELS } from '../../../shared/constants.js'

const NAV = {
  worker: [
    { section: 'Menu', items: [
      { to: '/worker/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/worker/profile', label: 'My Profile', icon: '👤' },
      { to: '/worker/documents', label: 'My Documents', icon: '📁' },
      { to: '/worker/leaves', label: 'Leave Management', icon: '🌴' },
      { to: '/worker/attendance', label: 'Attendance', icon: '🕐' },
      { to: '/worker/salary', label: 'Salary', icon: '💰' },
      { to: '/worker/letters', label: 'Company Letters', icon: '📄' },
      { to: '/worker/notifications', label: 'Notifications', icon: '🔔' },
    ]},
  ],
  it: [
    { section: 'IT Department', items: [
      { to: '/it/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/it/workers', label: 'Worker Registration', icon: '👷' },
      { to: '/it/verification', label: 'Document Verification', icon: '✅' },
      { to: '/it/leaves', label: 'Leave Approvals', icon: '🌴' },
      { to: '/it/letters', label: 'Letters', icon: '📄' },
      { to: '/it/emails', label: 'Email Management', icon: '✉️' },
      { to: '/it/access', label: 'Employee Access', icon: '🔐' },
      { to: '/it/audit', label: 'Audit Logs', icon: '📋' },
    ]},
  ],
  director: [
    { section: 'Director', items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/admin/verification', label: 'Worker Verification', icon: '✅' },
      { to: '/admin/employees', label: 'Employee Management', icon: '👥' },
      { to: '/admin/leaves', label: 'Leave Approvals', icon: '🌴' },
      { to: '/admin/attendance', label: 'Attendance', icon: '🕐' },
      { to: '/admin/salary', label: 'Salary Management', icon: '💰' },
      { to: '/admin/letters', label: 'Letters', icon: '📄' },
      { to: '/admin/emails', label: 'Email Management', icon: '✉️' },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
      { to: '/admin/settings', label: 'System Settings', icon: '⚙️' },
    ]},
  ],
}

const TITLES = {
  '/worker/dashboard': 'Worker Dashboard',
  '/worker/profile': 'My Profile',
  '/worker/documents': 'My Documents',
  '/worker/leaves': 'Leave Management',
  '/worker/attendance': 'My Attendance',
  '/worker/salary': 'My Salary',
  '/worker/letters': 'Company Letters',
  '/worker/notifications': 'Notifications',
  '/it/dashboard': 'IT Dashboard',
  '/it/workers': 'Worker Registration',
  '/it/verification': 'Document Verification',
  '/it/leaves': 'Leave Approvals',
  '/it/letters': 'Letter Management',
  '/it/emails': 'Email Management',
  '/it/access': 'Employee Access',
  '/it/audit': 'Audit Logs',
  '/admin/dashboard': 'Director Dashboard',
  '/admin/verification': 'Worker Document Verification',
  '/admin/employees': 'Employee Management',
  '/admin/leaves': 'Leave Approvals',
  '/admin/attendance': 'Attendance Overview',
  '/admin/salary': 'Salary Management',
  '/admin/letters': 'Letter Management',
  '/admin/emails': 'Email Management',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/settings': 'System Settings',
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const notifRef = useRef(null)

  const role = user?.role
  const nav = NAV[role] || []

  useEffect(() => {
    if (!role) return
    let cancelled = false
    const load = () => {
      api.get('/notifications', { limit: 20 }).then((res) => {
        if (cancelled) return
        setNotifications(res.data.rows)
        setUnread(res.data.unreadCount)
      }).catch(() => {})
    }
    load()
    const interval = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [role])

  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const markAllRead = async () => {
    await api.put('/notifications/read-all')
    setUnread(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })))
  }

  const pathname = window.location.pathname
  const title = TITLES[pathname] || 'Payivva HRCRM'

  return (
    <div className="layout">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">P</div>
          <div>
            <div className="sidebar-brand-name">Payivva HRCRM</div>
            <div className="sidebar-brand-sub">{ROLE_LABELS[role]}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section-label">{group.section}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">Payivva Technologies (OPC) Pvt Ltd</div>
      </aside>

      <div className="layout-main">
        <header className="topbar">
          <button type="button" className="topbar-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <div ref={notifRef}>
              <button type="button" className="icon-btn" onClick={() => setNotifsOpen((v) => !v)} aria-label="Notifications">
                🔔
                {unread > 0 && <span className="badge-dot">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notifsOpen && (
                <div className="dropdown" style={{ width: 340 }}>
                  <div className="dropdown-header flex items-center justify-between">
                    <strong>Notifications</strong>
                    {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
                  </div>
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {notifications.length === 0 && <div className="empty-state" style={{ padding: 24 }}><div className="empty-title">No notifications</div></div>}
                    {notifications.map((n) => (
                      <div key={n.id} className={`notif-item ${n.isRead ? '' : 'unread'}`} onClick={() => setNotifsOpen(false)}>
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">{timeAgo(n.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button type="button" className="user-chip" onClick={() => setUserMenuOpen((v) => !v)}>
                <Avatar name={user?.employeeName || user?.name || user?.email} />
                <span className="user-meta">
                  <span className="user-name">{user?.employeeName || user?.name || 'User'}</span>
                  <span className="user-role">{ROLE_LABELS[user?.role]}</span>
                </span>
                <span className="text-muted text-xs">▼</span>
              </button>
              {userMenuOpen && (
                <div className="dropdown">
                  <div className="dropdown-header">
                    <div className="font-semibold">{user?.employeeName || user?.name}</div>
                    <div className="text-xs text-muted">{user?.email}</div>
                  </div>
                  {role === 'worker' && (
                    <button type="button" className="dropdown-item" onClick={() => { setUserMenuOpen(false); navigate('/worker/profile') }}>
                      👤 My Profile
                    </button>
                  )}
                  <button type="button" className="dropdown-item" onClick={handleLogout}>🚪 Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}