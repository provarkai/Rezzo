'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRezzoStore, apiGet } from '@/store/rezzo-store'
import { CaseCard } from '@/components/rezzo/CaseCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertCircle, Shield } from 'lucide-react'

interface CaseItem {
  id: string
  caseNumber: string
  status: string
  need?: { title?: string; description?: string }
  createdAt: string
  updatedAt: string
}

type FilterTab = 'active' | 'resolved' | 'disputed'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'disputed', label: 'Disputed' },
]

const ACTIVE_STATUSES = ['NEW', 'UNDERSTANDING', 'CLARIFICATION', 'ROUTED', 'MATCHING', 'QUOTE', 'ACCEPTED', 'PAYMENT', 'FUNDED', 'IN_PROGRESS', 'PROOF', 'CUSTOMER_REVIEW']
const RESOLVED_STATUSES = ['RESOLVED', 'COMPLETED']
const DISPUTED_STATUSES = ['DISPUTED']

function matchesFilter(status: string, filter: FilterTab): boolean {
  const s = status.toUpperCase()
  switch (filter) {
    case 'active': return ACTIVE_STATUSES.includes(s)
    case 'resolved': return RESOLVED_STATUSES.includes(s)
    case 'disputed': return DISPUTED_STATUSES.includes(s)
    default: return true
  }
}

export function CaseList() {
  const setSelectedCaseId = useRezzoStore((s) => s.setSelectedCaseId)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ cases: CaseItem[] }>('/cases')
      setCases(data.cases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  const filteredCases = cases.filter((c) => matchesFilter(c.status, filter))

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-[#102A43]">My Cases</h1>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              filter === tab.id
                ? 'bg-white text-[#102A43] shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12">
          <AlertCircle className="size-10 text-rezzo-danger mx-auto mb-3" />
          <p className="text-sm text-rezzo-danger mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCases}>
            Try Again
          </Button>
        </div>
      )}

      {!loading && !error && filteredCases.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
            <Shield className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-[#102A43]">
            {filter === 'active' && 'No active cases. Tell REZZO what you need.'}
            {filter === 'resolved' && 'No resolved cases yet.'}
            {filter === 'disputed' && 'No disputed cases.'}
          </p>
          {filter === 'active' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
              onClick={() => {
                const setTab = useRezzoStore.getState().setCustomerTab
                setTab('home')
              }}
            >
              Create a Case
            </Button>
          )}
        </div>
      )}

      {!loading && !error && filteredCases.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredCases.map((c) => (
            <CaseCard
              key={c.id}
              caseNumber={c.caseNumber}
              status={c.status}
              title={c.need?.title || c.need?.description || 'Untitled case'}
              date={new Date(c.createdAt).toLocaleDateString('en-NG', {
                day: 'numeric',
                month: 'short',
              })}
              onClick={() => setSelectedCaseId(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
