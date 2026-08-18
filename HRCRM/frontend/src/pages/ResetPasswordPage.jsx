import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiError } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { Spinner } from '../components/ui/Feedback.jsx'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const toast = useToast()

  const [mode] = useState(token ? 'reset' : 'request')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const request = async (e) => {
    e.preventDefault()
    setError('')
    if (!identifier.trim()) {
      setError('Enter your email or employee ID.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { identifier: identifier.trim() })
      setMessage(res.message || 'If an account exists, a reset link has been sent to your email.')
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  const reset = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      toast.success('Password reset successful. Please login.')
      navigate('/login')
    } catch (err) {
      setError(apiError(err))
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="login-brand">
          <div className="login-logo">P</div>
          <div className="login-title">Reset Password</div>
          <div className="login-sub">
            {mode === 'reset' ? 'Enter your new password below.' : 'Enter your email or Employee ID to receive a reset link.'}
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}
        {message && <div className="card-pad" style={{ background: 'var(--success-light)', borderRadius: 8, marginBottom: 14 }}><span className="text-success font-semibold">{message}</span></div>}

        {mode === 'request' ? (
          <form onSubmit={request}>
            <div className="field">
              <label htmlFor="ident">Email / Employee ID</label>
              <input id="ident" className="input" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@payivva.com" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? <Spinner /> : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <div className="field">
              <label htmlFor="np">New Password</label>
              <input id="np" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
            </div>
            <div className="field">
              <label htmlFor="np2">Confirm Password</label>
              <input id="np2" className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? <Spinner /> : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="text-center mt-16 text-sm">
          Remembered your password? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }}>Back to login</a>
        </div>
      </div>
    </div>
  )
}