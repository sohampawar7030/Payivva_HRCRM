import { useEffect, useRef, useState } from 'react'
import { api, apiError } from '../../api/client.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { LoadingPage } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { ConfirmDialog } from '../../components/ui/Modal.jsx'
import { formatDate } from '../../utils/format.js'
import { openFile } from '../../utils/files.js'
import { DOCUMENT_TYPES } from '../../../../shared/constants.js'

const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function WorkerDocuments() {
  const toast = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const fileRef = useRef(null)

  const load = () => {
    api.get(`/documents/employee/${user.employeeId}`).then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }
  useEffect(load, [user.employeeId])

  const byType = (type) => (rows || []).filter((d) => d.docType === type)

  const onFile = async (e, docType) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only PDF, JPG or PNG files are allowed')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('File must be under 2 MB')
      return
    }
    setUploading(true)
    try {
      const buf = await file.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      const content = btoa(bin)
      await api.post('/documents/upload', {
        employeeId: user.employeeId,
        docType,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        content,
      })
      toast.success('Document uploaded')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setUploading(false)
    }
  }

  const open = (id) => {
    openFile(`/documents/${id}/download`)
  }

  const doReject = async () => {
    try {
      await api.put(`/documents/${rejectTarget.id}/verify`, { decision: 'rejected', remarks: rejectRemarks })
      toast.success('Document rejected')
      setRejectTarget(null)
      setRejectRemarks('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  if (!rows) return <LoadingPage label="Loading documents..." />

  const required = Object.entries(DOCUMENT_TYPES).filter(([, v]) => v.required)
  const optional = Object.entries(DOCUMENT_TYPES).filter(([, v]) => !v.required)

  const renderType = ([type, meta]) => {
    const docs = byType(type)
    const latest = docs[0]
    return (
      <div key={type} className="card card-pad">
        <div className="flex items-center justify-between">
          <div>
            <strong className="text-sm">{meta.label}</strong>
            <div className="text-xs text-muted mt-4">
              {meta.category.replace('_', ' ')} · {meta.required ? 'Required' : 'Optional'}
              {latest && ` · v${latest.version} (${formatDate(latest.uploadedAt)})`}
            </div>
          </div>
          {latest ? (
            <div className="flex items-center gap-8">
              <StatusBadge status={latest.verificationStatus} />
              <button className="btn btn-secondary btn-sm" onClick={() => open(latest.id)}>View</button>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                Re-upload
                <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onFile(e, type)} disabled={uploading} />
              </label>
              {!['it', 'director'].includes(user.role) && ['pending', 'rejected'].includes(latest.verificationStatus) && (
                <button className="btn btn-ghost btn-sm" onClick={() => setRejectTarget(latest)}>✕</button>
              )}
            </div>
          ) : (
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
              Upload
              <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onFile(e, type)} disabled={uploading} />
            </label>
          )}
        </div>
        {docs.length > 1 && (
          <div className="mt-12 text-xs text-muted">
            {docs.length - 1} previous version(s) hidden
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My Documents</div>
          <div className="page-subtitle">PDF, JPG or PNG · maximum 2 MB per file</div>
        </div>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
        <input ref={fileRef} type="file" hidden onChange={(e) => onFile(e, 'other')} />
      </div>

      <h3 className="mb-12">Required Documents</h3>
      <div className="stack" style={{ display: 'grid', gap: 10 }}>
        {required.map(renderType)}
      </div>

      <h3 className="mt-24 mb-12">Optional Documents</h3>
      <div className="stack" style={{ display: 'grid', gap: 10 }}>
        {optional.map(renderType)}
      </div>

      <ConfirmDialog
        open={!!rejectTarget}
        title="Delete this document?"
        message={`This will remove "${rejectTarget?.originalName}" from your profile. Previously approved versions will be restored as the latest.`}
        confirmLabel="Delete"
        onConfirm={doReject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  )
}