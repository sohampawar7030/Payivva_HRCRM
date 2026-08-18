import { api } from '../api/client.js'

export async function openFile(url, params = {}, opts = {}) {
  try {
    const blob = await api.download(url, params, opts)
    const objectUrl = URL.createObjectURL(blob)
    window.open(objectUrl, '_blank')
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
  } catch {
    // the api client redirects to /login on 401; other errors are silent
  }
}