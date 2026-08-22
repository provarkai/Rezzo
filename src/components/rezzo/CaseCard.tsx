'use client'

import { Card } from '@/components/ui/card'
import { StatusBadge } from './StatusBadge'
import { ArrowRight, Clock, Shield } from 'lucide-react'

interface CaseCardProps {
  caseNumber: string
  status: string
  title: string
  date?: string
  protectionStatus?: string
  onClick?: () => void
}

export function CaseCard({ caseNumber, status, title, date, protectionStatus, onClick }: CaseCardProps) {
  return (
    <Card
      className="p-4 rounded-xl border-border/60 rezzo-card-hover cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
      aria-label={`Case ${caseNumber}: ${title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-rezzo-navy">{caseNumber}</span>
            <StatusBadge status={status} />
            {protectionStatus === 'PROTECTED' && (
              <Shield className="size-3.5 text-rezzo-green shrink-0" aria-label="REZZO Protected" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{title}</p>
          {date && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>{date}</span>
            </div>
          )}
        </div>
        <ArrowRight className="size-4 text-muted-foreground mt-1 shrink-0" />
      </div>
    </Card>
  )
}
