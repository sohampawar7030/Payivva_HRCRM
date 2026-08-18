import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeParse(localStorage.getItem('hrcrm_user')))
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('hrcrm_access_token')))

  useEffect(() => {
    if (!localStorage.getItem('hrcrm_access_token')) return
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data)
        localStorage.setItem('hrcrm_user', JSON.stringify(res.data))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async ({ identifier, password, role }) => {
    const res = await api.post('/auth/login', { identifier, password, role })
    const data = res.data
    localStorage.setItem('hrcrm_access_token', data.accessToken)
    localStorage.setItem('hrcrm_user', JSON.stringify(data))
    setUser(data)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    localStorage.removeItem('hrcrm_access_token')
    localStorage.removeItem('hrcrm_user')
    setUser(null)
  }, [])

  const homePath = useCallback(() => {
    if (!user) return '/login'
    if (user.role === 'worker') return '/worker/dashboard'
    if (user.role === 'it') return '/it/dashboard'
    return '/admin/dashboard'
  }, [user])

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, homePath }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}