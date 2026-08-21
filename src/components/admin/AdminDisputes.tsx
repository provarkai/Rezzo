'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { apiGet, apiPost, extractList } from '@/store/rezzo-store'
import { AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface DisputeItem {
  id: string
  caseId: string
  caseNumber: string
  caseTitle: string | null
  caseStatus: string
  professionalName: string | null
  payment: { grossAmount: number; status: string } | null
  openedByName: string | null
  openedByRole: string | null
  reason: string | null
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED'
  professionalResponse: string | null
  professionalRespondedAt: string | null
  outcome: string | null
  resolutionCode: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
  createdAt: string
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'UNDER_REVIEW', label: 'Under Review' },
  { id: 'RESOLVED', label: 'Resolved' },
] as const

const OUTCOMES = [
  { id: 'REFUND', label: 'Refund customer' },
  { id: 'PARTIAL_REFUND', label: 'Partial refund' },
  { id: 'RELEASE_PAYOUT', label: 'Release payout to professional' },
  { id: 'DISMISSED', label: 'Dismiss dispute' },
] as const

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    OPEN: 'bg-rezzo-danger/10 text-rezzo-danger',
    UNDER_REVIEW: 'bg-rezzo-gold/10 text-rezzo-gold',
    RESOLVED: 'bg-rezzo-green/10 text-rezzo-green',
    CLOSED: 'bg-muted text-muted-foreground',
  }
  return <Badge className={`border-0 text-xs ${styles[status] || ''}`}>{status.replace('_', ' ')}</Badge>
}

export function AdminDisputes() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('OPEN')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string>('DISMISSED')
  const [notes, setNotes] = useState('')
  const [resolving, setResolving] = useState(false)

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const query = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const data = await apiGet(`/admin/disputes${query}`)
      setDisputes(extractList<DisputeItem>(data, 'disputes'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchDisputes()
  }, [fetchDisputes])

  const toggleExpand = (d: DisputeItem) => {
    if (expandedId === d.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(d.id)
    setOutcome('DISMISSED')
    setNotes('')
  }

  const resolve = async (id: string) => {
    try {
      setResolving(true)
      await apiPost(`/admin/disputes/${id}`, { outcome, notes: notes || undefined })
      setExpandedId(null)
      await fetchDisputes()
    } catch {
      // silent — row stays expanded, admin can retry
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
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
        <Button variant="outline" size="sm" onClick={fetchDisputes}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <AlertTriangle className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          A dispute freezes nothing automatically — review the case's scope, payment and the
          professional's response, then record an outcome. REZZO facilitates resolution here; it
          is not a court or regulator.
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
                <TableHead className="text-xs">Professional</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Opened By</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Opened</TableHead>
                <TableHead className="text-xs text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No disputes {statusFilter !== 'all' ? `in ${statusFilter.toLowerCase().replace('_', ' ')}` : ''}
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map((d) => (
                  <Fragment key={d.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(d)}>
                      <TableCell>
                        <span className="text-xs font-semibold text-[#102A43]">{d.caseNumber}</span>
                        {d.caseTitle && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{d.caseTitle}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.professionalName || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.payment ? formatNaira(d.payment.grossAmount) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.openedByName || '—'} {d.openedByRole && <span className="text-[10px]">({d.openedByRole})</span>}
                      </TableCell>
                      <TableCell>{statusBadge(d.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleDateString('en-NG')}
                      </TableCell>
                      <TableCell className="text-right">
                        {expandedId === d.id ? <ChevronUp className="size-4 inline text-muted-foreground" /> : <ChevronDown className="size-4 inline text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                    {expandedId === d.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <DisputeDetail
                            dispute={d}
                            outcome={outcome}
                            setOutcome={setOutcome}
                            notes={notes}
                            setNotes={setNotes}
                            resolving={resolving}
                            onResolve={() => resolve(d.id)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-3 space-y-2">
          {disputes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No disputes</p>
          ) : (
            disputes.map((d) => (
              <div key={d.id} className="rounded-lg border border-border/60 overflow-hidden">
                <button className="w-full text-left p-3" onClick={() => toggleExpand(d)}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <span className="text-xs font-semibold text-[#102A43]">{d.caseNumber}</span>
                      <p className="text-[11px] text-muted-foreground">{d.professionalName || '—'}</p>
                    </div>
                    {statusBadge(d.status)}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{d.reason}</p>
                </button>
                {expandedId === d.id && (
                  <div className="border-t border-border/60 p-3 bg-muted/30">
                    <DisputeDetail
                      dispute={d}
                      outcome={outcome}
                      setOutcome={setOutcome}
                      notes={notes}
                      setNotes={setNotes}
                      resolving={resolving}
                      onResolve={() => resolve(d.id)}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

function DisputeDetail({
  dispute,
  outcome,
  setOutcome,
  notes,
  setNotes,
  resolving,
  onResolve,
}: {
  dispute: DisputeItem
  outcome: string
  setOutcome: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  resolving: boolean
  onResolve: () => void
}) {
  return (
    <div className="py-2 space-y-3" onClick={(e) => e.stopPropagation()}>
      {dispute.reason && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Customer's reason</p>
          <p className="text-xs text-foreground">{dispute.reason}</p>
        </div>
      )}
      {dispute.professionalResponse ? (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Professional's response</p>
          <p className="text-xs text-foreground">{dispute.professionalResponse}</p>
        </div>
      ) : (
        <p className="text-[11px] text-rezzo-gold">No response from the professional yet.</p>
      )}
      {dispute.payment && (
        <p className="text-[11px] text-muted-foreground">
          Payment: {formatNaira(dispute.payment.grossAmount)} · {dispute.payment.status}
        </p>
      )}

      {dispute.status === 'RESOLVED' ? (
        <div className="p-2 rounded-md bg-rezzo-green/5 border border-rezzo-green/20">
          <p className="text-xs font-medium text-rezzo-green">
            Resolved: {dispute.outcome?.replace(/_/g, ' ').toLowerCase()}
          </p>
          {dispute.resolutionNotes && (
            <p className="text-[11px] text-muted-foreground mt-1">{dispute.resolutionNotes}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-white px-3 text-xs"
          >
            {OUTCOMES.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for the record (visible to both parties)..."
            rows={2}
            className="text-xs bg-white"
          />
          <Button
            size="sm"
            className="bg-[#102A43] hover:bg-[#102A43]/90 text-white"
            disabled={resolving}
            onClick={onResolve}
          >
            {resolving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            Record outcome
          </Button>
        </div>
      )}
    </div>
  )
}
