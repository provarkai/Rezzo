'use client'

import { Badge } from '@/components/ui/badge'

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  UNDERSTANDING: 'Analyzing',
  CLARIFICATION: 'Needs Info',
  CONFIRMATION: 'Confirm Understanding',
  ROUTED: 'Routed',
  MATCHING: 'Finding Pros',
  QUOTE: 'Quoting',
  ACCEPTED: 'Accepted',
  PAYMENT: 'Payment',
  FUNDED: 'Funded',
  IN_PROGRESS: 'In Progress',
  PROOF: 'Review Proof',
  CUSTOMER_REVIEW: 'Your Review',
  COMPLETED: 'Completed',
  RESOLVED: 'Resolved',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
}

const STATUS_CLASSES: Record<string, string> = {
  NEW: 'case-status-new',
  UNDERSTANDING: 'case-status-understanding',
  CLARIFICATION: 'case-status-clarification',
  CONFIRMATION: 'case-status-clarification',
  ROUTED: 'case-status-routed',
  MATCHING: 'case-status-matching',
  QUOTE: 'case-status-quote',
  ACCEPTED: 'case-status-accepted',
  PAYMENT: 'case-status-payment',
  FUNDED: 'case-status-funded',
  IN_PROGRESS: 'case-status-in_progress',
  PROOF: 'case-status-proof',
  CUSTOMER_REVIEW: 'case-status-customer_review',
  COMPLETED: 'case-status-completed',
  RESOLVED: 'case-status-resolved',
  DISPUTED: 'case-status-disputed',
  CANCELLED: 'case-status-cancelled',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const upper = status.toUpperCase().replace(/\s+/g, '_')
  const label = STATUS_LABELS[upper] || status
  const colorClass = STATUS_CLASSES[upper] || 'case-status-new'

  return (
    <Badge
      variant="outline"
      className={`border-0 px-2.5 py-0.5 text-xs font-medium rounded-full ${colorClass} ${className}`}
    >
      {label}
    </Badge>
  )
}
