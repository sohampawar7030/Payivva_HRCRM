import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { LoadingPage, EmptyState } from '../../components/ui/Feedback.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { formatDate, formatDateTime } from '../../utils/format.js'
import { openFile } from '../../utils/files.js'
import { LETTER_TYPE_LABELS } from '../../../../shared/constants.js'

export default function WorkerLetters() {
  const [rows, setRows] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    api.get('/letters/mine').then((res) => setRows(res.data.rows)).catch(() => setRows([]))
  }, [])

  if (!rows) return <LoadingPage label="Loading letters..." />

  const openPdf = (id) => openFile(`/letters/${id}/pdf`)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My Letters</div>
          <div className="page-subtitle">Offer, joining, appointment, increment and promotion letters</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Company Letters</div></div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 && <EmptyState icon="📄" title="No letters yet" sub="Letters issued to you will appear here." />}
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Type</th><th>Version</th><th>Generated</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.title}</strong></td>
                  <td>{LETTER_TYPE_LABELS[l.letterType] || l.letterType}</td>
                  <td>v{l.version}</td>
                  <td>{formatDateTime(l.generatedAt)}</td>
                  <td><StatusBadge status={l.status} labels={{ generated: 'Generated', sent: 'Sent' }} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetail(l)}>Details</button>
                    {l.pdfContent && <button className="btn btn-secondary btn-sm" onClick={() => openPdf(l.id)}>View PDF</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Letter Details">
        {detail && (
          <div className="detail-stack">
            <div className="detail-item"><div className="k">Title</div><div className="v">{detail.title}</div></div>
            <div className="detail-item"><div className="k">Type</div><div className="v">{LETTER_TYPE_LABELS[detail.letterType] || detail.letterType}</div></div>
            <div className="detail-item"><div className="k">Version</div><div className="v">v{detail.version}</div></div>
            <div className="detail-item"><div className="k">Generated</div><div className="v">{formatDateTime(detail.generatedAt)}</div></div>
            <div className="detail-item"><div className="k">Status</div><div className="v"><StatusBadge status={detail.status} labels={{ generated: 'Generated', sent: 'Sent' }} /></div></div>
            {detail.sentTo && <div className="detail-item"><div className="k">Sent To</div><div className="v">{detail.sentTo} · {formatDate(detail.sentAt)}</div></div>}
            {detail.extra && Object.keys(detail.extra).length > 0 && (
              <div className="mt-16">
                <div className="text-sm font-semibold mb-8">Letter Details</div>
                {Object.entries(detail.extra).map(([k, v]) => (
                  <div key={k} className="detail-item"><div className="k">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</div><div className="v">{String(v)}</div></div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}