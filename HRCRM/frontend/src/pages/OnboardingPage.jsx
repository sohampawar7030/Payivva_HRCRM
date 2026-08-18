import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, apiError } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { Spinner, LoadingPage } from '../components/ui/Feedback.jsx'

export default function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const employee = params.get('employee')
  const token = params.get('token')

  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!employee || !token) {
      setError('This onboarding link is incomplete. Contact the IT Department.')
      setLoading(false)
      return
    }
    api.get('/auth/onboarding', { employee, token })
      .then((res) => setInfo(res.data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false))
  }, [employee, token])

  const submit = async (e) => {
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
    setSubmitting(true)
    try {
      await api.post('/auth/onboarding/complete', { employeeCode: employee, token, password })
      toast.success('Onboarding complete! You can now login.')
      navigate('/login')
    } catch (err) {
      setError(apiError(err))
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingPage label="Checking onboarding link..." />

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="login-brand">
          <div className="login-logo">P</div>
          <div className="login-title">Welcome to Payivva</div>
          {info ? (
            <div className="login-sub">
              {info.employeeName} ({info.employeeCode}) — set a password to activate your HRCRM account.
            </div>
          ) : (
            <div className="login-sub">Employee onboarding</div>
          )}
        </div>

        {error && <div className="login-error">{error}</div>}

        {info && (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="pwd">New Password</label>
              <input id="pwd" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
            </div>
            <div className="field">
              <label htmlFor="pwd2">Confirm Password</label>
              <input id="pwd2" className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
              {submitting ? <Spinner /> : 'Activate Account'}
            </button>
            <div className="text-center mt-16 text-sm">
              Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login') }}>Login</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}