'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, apiPost, extractList } from '@/store/rezzo-store'
import { BrainCircuit, Loader2, AlertTriangle } from 'lucide-react'

interface AiJobItem {
  id: string
  agentName: string | null
  objective: string | null
  risk: string
  confidence: number
  status: string
  highRiskCategory: string | null
  outputJson?: { intent?: string; nextAction?: string } | null
  reviewedAt: string | null
  reviewNotes: string | null
  createdAt: string
  case: { id: string; caseNumber: string; need?: { title?: string } | null } | null
  reviewer: { profile?: { displayName?: string } | null } | null
}

const STATUS_FILTERS = [
  { id: 'ESCALATED', label: 'Needs Review' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed' },
] as const

function riskBadge(risk: string) {
  const styles: Record<string, string> = {
    NORMAL: 'bg-muted text-muted-foreground',
    ELEVATED: 'bg-rezzo-gold/10 text-rezzo-gold',
    HIGH: 'bg-rezzo-danger/10 text-rezzo-danger',
  }
  return <Badge className={`border-0 text-xs ${styles[risk] || styles.NORMAL}`}>{risk}</Badge>
}

export function AdminAiOversight() {
  const [jobs, setJobs] = useState<AiJobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ESCALATED')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const query = statusFilter === 'ESCALATED' ? '?status=ESCALATED&unreviewed=true' : `?status=${statusFilter}&unreviewed=false`
      const data = await apiGet(`/admin/ai-jobs${query}`)
      setJobs(extractList<AiJobItem>(data, 'jobs'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI jobs')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    setNotes('')
  }

  const review = async (id: string) => {
    try {
      setReviewing(true)
      await apiPost(`/admin/ai-jobs/${id}`, { notes: notes || undefined })
      setExpandedId(null)
      await fetchJobs()
    } catch {
      // row stays expanded, admin can retry
    } finally {
      setReviewing(false)
    }
  }

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchJobs}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <BrainCircuit className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          Every case classification is logged as an AI job with its confidence and risk level.
          One escalates for human review when confidence is low, a §16.2 high-risk category is
          detected (legal, financial, healthcare, government/identity, safety-critical), or the
          AI itself flagged it — the case still proceeds through its normal customer-facing flow
          in parallel; escalation surfaces it here, it doesn't block it.
        </p>
      </div>

      <div className="flex gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive ? 'bg-[#102A43] text-white' : 'bg-white text-muted-foreground hover:text-foreground border border-border/60'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {jobs.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">
          {statusFilter === 'ESCALATED' ? 'Nothing waiting on review.' : `No ${statusFilter.toLowerCase()} jobs`}
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <Card key={job.id} className={job.highRiskCategory ? 'border-rezzo-danger/30' : ''}>
              <button className="w-full text-left p-3" onClick={() => toggleExpand(job.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#102A43]">
                        {job.case?.caseNumber || 'No case'}
                      </span>
                      {riskBadge(job.risk)}
                      {job.highRiskCategory && (
                        <Badge className="border-0 text-xs bg-rezzo-danger text-white gap-1">
                          <AlertTriangle className="size-2.5" /> {job.highRiskCategory.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {job.case?.need?.title || job.objective}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">
                    {Math.round(job.confidence * 100)}% confident
                  </span>
                </div>
                {job.reviewedAt && (
                  <p className="text-[11px] text-rezzo-green mt-1.5">
                    Reviewed by {job.reviewer?.profile?.displayName || 'admin'}
                    {job.reviewNotes ? `: ${job.reviewNotes}` : ''}
                  </p>
                )}
              </button>

              {expandedId === job.id && (
                <div className="px-3 pb-3 border-t border-border/60 pt-3 space-y-2">
                  {job.outputJson?.intent && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">AI understood:</span> {job.outputJson.intent}
                    </p>
                  )}
                  {!job.reviewedAt && (
                    <>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes on what you checked / did (optional)..."
                        rows={2}
                      />
                      <Button
                        size="sm"
                        className="bg-[#102A43] hover:bg-[#102A43]/90 text-white"
                        disabled={reviewing}
                        onClick={() => review(job.id)}
                      >
                        {reviewing ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                        Mark reviewed
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
