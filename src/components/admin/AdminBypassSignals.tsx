'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiGet, apiPost, extractList } from '@/store/rezzo-store'
import { ShieldAlert, Eye, X, CheckCircle2, Loader2 } from 'lucide-react'

interface BypassSignalItem {
  id: string
  caseId: string
  caseNumber: string
  caseTitle: string | null
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  signalType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CONFIRMED'
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN'
  evidenceRef: string | null
  createdAt: string
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'REVIEWED', label: 'Reviewed' },
  { id: 'DISMISSED', label: 'Dismissed' },
  { id: 'ACTION_TAKEN', label: 'Action Taken' },
] as const

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  DIRECT_PAYMENT_DETAILS: 'Direct payment details',
  OFF_PLATFORM_REQUEST: 'Off-platform request',
  REPEATED_CONTACT_REQUEST: 'Contact reference',
  POST_ACCEPT_CANCELLATION: 'Post-accept cancellation',
  OTHER: 'Other',
}

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    LOW: 'bg-muted text-muted-foreground',
    MEDIUM: 'bg-rezzo-gold/10 text-rezzo-gold',
    HIGH: 'bg-rezzo-danger/10 text-rezzo-danger',
    CONFIRMED: 'bg-rezzo-danger text-white',
  }
  return <Badge className={`border-0 text-xs ${styles[severity] || styles.LOW}`}>{severity}</Badge>
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN: 'bg-rezzo-gold/10 text-rezzo-gold',
    REVIEWED: 'bg-muted text-muted-foreground',
    DISMISSED: 'bg-muted text-muted-foreground',
    ACTION_TAKEN: 'bg-rezzo-green/10 text-rezzo-green',
  }
  return <Badge className={`border-0 text-xs ${styles[status] || ''}`}>{status.replace('_', ' ')}</Badge>
}

export function AdminBypassSignals() {
  const [signals, setSignals] = useState<BypassSignalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('OPEN')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchSignals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const data = await apiGet(`/admin/bypass-signals${query}`)
      setSignals(extractList<BypassSignalItem>(data, 'signals'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bypass signals')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchSignals()
  }, [fetchSignals])

  const review = async (id: string, status: 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN') => {
    try {
      setActionLoading(id)
      await apiPost(`/admin/bypass-signals/${id}`, { status })
      await fetchSignals()
    } catch {
      // silent — the row just won't update, admin can retry
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchSignals}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <ShieldAlert className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          Signals are risk indicators, not accusations — detected automatically from case messages
          (off-platform language, direct payment details, contact references). Review before acting;
          nothing here suspends a case or a user on its own.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#102A43] text-white'
                  : 'bg-white text-muted-foreground hover:text-foreground border border-border/60'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Case</TableHead>
                <TableHead className="text-xs">Signal</TableHead>
                <TableHead className="text-xs">Severity</TableHead>
                <TableHead className="text-xs">Actor</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Detected</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No bypass signals {statusFilter !== 'all' ? `in ${statusFilter.toLowerCase()}` : ''}
                  </TableCell>
                </TableRow>
              ) : (
                signals.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="text-xs font-semibold text-[#102A43]">{s.caseNumber}</span>
                      {s.caseTitle && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{s.caseTitle}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {SIGNAL_TYPE_LABELS[s.signalType] || s.signalType}
                    </TableCell>
                    <TableCell>{severityBadge(s.severity)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.actorName || '—'} {s.actorRole && <span className="text-[10px]">({s.actorRole})</span>}
                    </TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString('en-NG')}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status === 'OPEN' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            className="h-7 w-7 bg-muted text-muted-foreground hover:bg-muted/70"
                            title="Mark reviewed"
                            aria-label="Mark reviewed"
                            onClick={() => review(s.id, 'REVIEWED')}
                            disabled={actionLoading === s.id}
                          >
                            {actionLoading === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            className="h-7 w-7 bg-rezzo-green/10 text-rezzo-green hover:bg-rezzo-green/20"
                            title="Mark action taken"
                            aria-label="Mark action taken"
                            onClick={() => review(s.id, 'ACTION_TAKEN')}
                            disabled={actionLoading === s.id}
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-7 w-7 bg-rezzo-danger/10 text-rezzo-danger hover:bg-rezzo-danger/20"
                            title="Dismiss"
                            aria-label="Dismiss"
                            onClick={() => review(s.id, 'DISMISSED')}
                            disabled={actionLoading === s.id}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-3 space-y-2">
          {signals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No bypass signals</p>
          ) : (
            signals.map((s) => (
              <div key={s.id} className="p-3 rounded-lg border border-border/60">
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <span className="text-xs font-semibold text-[#102A43]">{s.caseNumber}</span>
                    <p className="text-[11px] text-muted-foreground">
                      {SIGNAL_TYPE_LABELS[s.signalType] || s.signalType}
                    </p>
                  </div>
                  {severityBadge(s.severity)}
                </div>
                <div className="flex items-center justify-between">
                  {statusBadge(s.status)}
                  {s.status === 'OPEN' && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        className="h-6 w-6 bg-rezzo-green/10 text-rezzo-green hover:bg-rezzo-green/20"
                        onClick={() => review(s.id, 'ACTION_TAKEN')}
                        disabled={actionLoading === s.id}
                        aria-label="Mark action taken"
                      >
                        <CheckCircle2 className="size-3" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-6 w-6 bg-rezzo-danger/10 text-rezzo-danger hover:bg-rezzo-danger/20"
                        onClick={() => review(s.id, 'DISMISSED')}
                        disabled={actionLoading === s.id}
                        aria-label="Dismiss"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
