'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/rezzo/StatusBadge'
import { apiGet, extractList } from '@/store/rezzo-store'
import { Filter, Search, Clock, ArrowRight } from 'lucide-react'

interface AdminCase {
  id: string
  caseNumber: string
  status: string
  title?: string
  createdAt: string
  matter?: { title?: string; category?: string; complexity?: string }
  customer?: { name?: string }
  professional?: { name?: string }
}

interface TimelineEvent {
  id: string
  type: string
  description: string
  createdAt: string
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active', statuses: ['MATCHING', 'QUOTE', 'ACCEPTED', 'PAYMENT', 'FUNDED', 'IN_PROGRESS', 'PROOF'] },
  { id: 'resolved', label: 'Resolved', statuses: ['RESOLVED', 'COMPLETED'] },
  { id: 'disputed', label: 'Disputed', statuses: ['DISPUTED'] },
] as const

export function AdminCaseQueue() {
  const [cases, setCases] = useState<AdminCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCase, setSelectedCase] = useState<AdminCase | null>(null)
  const [detailTimeline, setDetailTimeline] = useState<TimelineEvent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        const filterObj = STATUS_FILTERS.find((f) => f.id === statusFilter)
        if (filterObj && 'statuses' in filterObj) {
          params.set('status', filterObj.statuses.join(','))
        }
      }
      const data = await apiGet('/admin/cases')
      setCases(extractList<AdminCase>(data, 'cases'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const openCaseDetail = async (c: AdminCase) => {
    setSelectedCase(c)
    setDetailDialogOpen(true)
    setDetailLoading(true)
    try {
      const tl = await apiGet<TimelineEvent[]>(`/cases/${c.id}/timeline`).catch(() => [])
      setDetailTimeline(Array.isArray(tl) ? tl : [])
    } catch {
      setDetailTimeline([])
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredCases = cases.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.caseNumber.toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.customer?.name || '').toLowerCase().includes(q) ||
      (c.matter?.category || '').toLowerCase().includes(q)
    )
  })

  const getCaseAge = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffMs = now.getTime() - created.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1d'
    return `${diffDays}d`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchCases}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cases..."
            className="w-full h-8 pl-9 pr-3 rounded-lg border border-input bg-white text-xs"
          />
        </div>
      </div>

      {/* Table - Desktop */}
      <Card className="overflow-hidden">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Case #</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Age</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No cases found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCases.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="text-xs font-semibold">{c.caseNumber}</TableCell>
                    <TableCell className="text-xs">{c.customer?.name || '—'}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.matter?.category || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3" />
                        {getCaseAge(c.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => openCaseDetail(c)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-3 space-y-2">
          {filteredCases.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No cases found</p>
          ) : (
            filteredCases.map((c) => (
              <button
                key={c.id}
                onClick={() => openCaseDetail(c)}
                className="w-full p-3 rounded-lg border border-border/60 text-left rezzo-card-hover"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#102A43]">{c.caseNumber}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.title || c.matter?.title || 'Untitled'}
                </p>
                <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>{c.customer?.name || '—'}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="size-2.5" />
                    {getCaseAge(c.createdAt)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Case Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedCase?.caseNumber}</span>
              {selectedCase && <StatusBadge status={selectedCase.status} />}
            </DialogTitle>
          </DialogHeader>

          {selectedCase && (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-4">
                {/* Case Info */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-1">Title</h3>
                  <p className="text-sm text-foreground">
                    {selectedCase.title || selectedCase.matter?.title || 'Untitled'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-1">Customer</h3>
                    <p className="text-foreground">{selectedCase.customer?.name || '—'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-1">Professional</h3>
                    <p className="text-foreground">{selectedCase.professional?.name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-1">Category</h3>
                    <p className="text-foreground">{selectedCase.matter?.category || '—'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-1">Complexity</h3>
                    <p className="text-foreground">{selectedCase.matter?.complexity || '—'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-1">Created</h3>
                    <p className="text-foreground">
                      {new Date(selectedCase.createdAt).toLocaleString('en-NG')}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Timeline */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3">Timeline</h3>
                  {detailLoading ? (
                    <Skeleton className="h-32" />
                  ) : detailTimeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No timeline events</p>
                  ) : (
                    <div className="space-y-3">
                      {detailTimeline.map((event, idx) => {
                        const isLast = idx === detailTimeline.length - 1
                        return (
                          <div key={event.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-rezzo-green shrink-0 mt-1" />
                              {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
                            </div>
                            <div className="flex-1 pb-2">
                              <p className="text-xs font-medium text-foreground">
                                {event.description || event.type}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(event.createdAt).toLocaleString('en-NG', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
