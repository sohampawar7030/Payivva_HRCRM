import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrcrm_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      localStorage.removeItem('hrcrm_access_token')
      localStorage.removeItem('hrcrm_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

export function apiError(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong'
}

export function isApiError(err) {
  return Boolean(err?.response?.data)
}

export const api = {
  get: (url, params) => client.get(url, { params }).then((r) => r.data),
  post: (url, body) => client.post(url, body).then((r) => r.data),
  put: (url, body) => client.put(url, body).then((r) => r.data),
  del: (url) => client.delete(url).then((r) => r.data),
  download: (url, params, { download = false } = {}) =>
    client.get(url, { params: { ...params, download: download ? '1' : undefined }, responseType: 'blob' }).then((r) => r.data),
}

export default client