'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/rezzo/StatusBadge'
import { useRezzoStore, apiGet, extractList } from '@/store/rezzo-store'
import { Briefcase, ArrowRight } from 'lucide-react'

interface CaseItem {
  id: string
  caseNumber: string
  status: string
  title?: string
  createdAt: string
  matter?: { title?: string }
  customer?: { name?: string }
}

const FILTER_TABS = [
  { id: 'new', label: 'New', statuses: ['MATCHING', 'QUOTE'] },
  { id: 'active', label: 'Active', statuses: ['ACCEPTED', 'PAYMENT', 'FUNDED', 'IN_PROGRESS'] },
  { id: 'awaiting', label: 'Awaiting Customer', statuses: ['PROOF', 'CUSTOMER_REVIEW'] },
  { id: 'completed', label: 'Completed', statuses: ['COMPLETED', 'RESOLVED'] },
] as const

export function ProfessionalCaseList() {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('new')
  const setProSelectedCaseId = useRezzoStore((s) => s.setProSelectedCaseId)

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet('/cases')
      setCases(extractList<CaseItem>(data, 'cases'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const currentTab = FILTER_TABS.find((t) => t.id === activeFilter)
  const filteredCases = cases.filter((c) =>
    currentTab?.statuses.includes(c.status.toUpperCase())
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
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
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const count = cases.filter((c) =>
            tab.statuses.includes(c.status.toUpperCase())
          ).length
          const isActive = activeFilter === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#102A43] text-white'
                  : 'bg-white text-muted-foreground hover:text-foreground border border-border/60'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Case Cards */}
      {filteredCases.length === 0 ? (
        <Card className="p-8 text-center">
          <Briefcase className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-[#102A43]">No {currentTab?.label.toLowerCase()} cases</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeFilter === 'new'
              ? 'New matching cases will appear here'
              : activeFilter === 'completed'
                ? 'Completed cases will show here'
                : `No cases currently ${currentTab?.label.toLowerCase()}`}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCases.map((c) => {
            const date = new Date(c.createdAt).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'short',
            })
            return (
              <Card
                key={c.id}
                className="p-4 rounded-xl border-border/60 rezzo-card-hover cursor-pointer"
                onClick={() => setProSelectedCaseId(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setProSelectedCaseId(c.id)
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[#102A43]">
                        {c.caseNumber}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {c.title || c.matter?.title || 'Untitled Case'}
                    </p>
                    {c.customer?.name && (
                      <p className="text-xs text-muted-foreground mt-1">Customer: {c.customer.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{date}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground mt-1 shrink-0" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
