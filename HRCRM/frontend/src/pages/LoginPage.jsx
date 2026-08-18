import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { apiError } from '../api/client.js'
import { Spinner } from '../components/ui/Feedback.jsx'

const ROLES = [
  { value: 'worker', label: 'Worker' },
  { value: 'it', label: 'IT Department' },
  { value: 'director', label: 'Director / Admin' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!identifier.trim() || !password) {
      setError('Please enter your Email / Employee ID and password.')
      return
    }
    if (!role) {
      setError('Please select your role.')
      return
    }
    setLoading(true)
    try {
      const data = await login({ identifier: identifier.trim(), password, role })
      toast.success(`Welcome, ${data.name || data.employeeName || 'user'}!`)
      const dest = data.role === 'worker' ? '/worker/dashboard' : data.role === 'it' ? '/it/dashboard' : '/admin/dashboard'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">P</div>
          <div className="login-title">PAYIVVA HRCRM</div>
          <div className="login-sub">Human Resource & Company Resource Management</div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="identifier">Email / Employee ID</label>
            <input
              id="identifier"
              className="input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@payivva.com or PAYIVVA-SM-01"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="field">
            <label>Role</label>
            <div className="role-select">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`role-option ${role === r.value ? 'selected' : ''}`}
                  onClick={() => setRole(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? <Spinner /> : 'LOGIN'}
          </button>
        </form>

        <div className="login-link-row">
          <a href="/reset-password" onClick={(e) => { e.preventDefault(); navigate('/reset-password') }} className="text-sm">
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  )
}