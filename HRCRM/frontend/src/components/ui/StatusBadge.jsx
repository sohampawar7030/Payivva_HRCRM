import { useMemo } from 'react'
import {
  ROLES,
  ROLE_LABELS,
  LEAVE_TYPE_LABELS,
  LETTER_TYPE_LABELS,
  DOCUMENT_TYPES,
} from '../../../../shared/constants.js'

const STATUS_MAP = {
  // profile / verification
  not_started: ['gray', 'Not Started'],
  incomplete: ['warning', 'Incomplete'],
  submitted: ['blue', 'Pending IT'],
  it_approved: ['info', 'IT Approved · Pending Director'],
  it_rejected: ['danger', 'IT Rejected'],
  director_approved: ['purple', 'Director Approved'],
  director_rejected: ['danger', 'Director Rejected'],
  fully_verified: ['success', 'Fully Verified'],
  // leave
  draft: ['gray', 'Draft'],
  pending_it: ['blue', 'Pending IT'],
  pending_director: ['info', 'Pending Director'],
  cancelled: ['gray', 'Cancelled'],
  // documents
  approved: ['success', 'Approved'],
  pending: ['warning', 'Pending'],
  // payroll
  finalized: ['success', 'Finalized'],
  paid: ['purple', 'Paid'],
  // employee
  active: ['success', 'Active'],
  inactive: ['gray', 'Inactive'],
  pending_onboarding: ['warning', 'Pending Onboarding'],
  // misc
  sent: ['success', 'Sent'],
  failed: ['danger', 'Failed'],
  present: ['success', 'Present'],
  absent: ['gray', 'Absent'],
  late: ['warning', 'Late'],
  hold: ['warning', 'On Hold'],
  on_hold: ['danger', 'On Hold'],
  stopped: ['gray', 'Stopped'],
  running: ['success', 'Running'],
  half_day: ['info', 'Half Day'],
  wfh: ['purple', 'WFH'],
  leave: ['blue', 'Leave'],
  generated: ['blue', 'Generated'],
}

export default function StatusBadge({ status, labels, className = '' }) {
  const meta = useMemo(() => {
    if (labels && labels[status]) return ['blue', labels[status]]
    return STATUS_MAP[status] || ['gray', status || '—']
  }, [status, labels])
  return <span className={`badge badge-${meta[0]} ${className}`}>{meta[1]}</span>
}

export const LABELS = { ROLE_LABELS, LEAVE_TYPE_LABELS, LETTER_TYPE_LABELS, DOCUMENT_TYPES, ROLES }