'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/rezzo/StatusBadge'
import { TrustScore } from '@/components/rezzo/TrustScore'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { useRezzoStore, apiGet, extractList } from '@/store/rezzo-store'
import {
  Briefcase,
  Clock,
  TrendingUp,
  Shield,
  ArrowRight,
  FileText,
  Wrench,
} from 'lucide-react'

interface CaseItem {
  id: string
  caseNumber: string
  status: string
  title?: string
  createdAt: string
  matter?: { title?: string }
}

interface DashboardData {
  cases: CaseItem[]
  newCount: number
  activeCount: number
  revenue: number
  trustScore: number
}

export function ProfessionalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setProfessionalTab = useRezzoStore((s) => s.setProfessionalTab)
  const setProSelectedCaseId = useRezzoStore((s) => s.setProSelectedCaseId)
  const currentUser = useRezzoStore((s) => s.currentUser)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const cases = extractList<CaseItem>(await apiGet('/cases'), 'cases')
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const activeCases = cases.filter((c) =>
        ['QUOTE', 'ACCEPTED', 'PAYMENT', 'FUNDED', 'IN_PROGRESS', 'PROOF'].includes(c.status.toUpperCase())
      )
      const newCases = cases.filter((c) => c.status.toUpperCase() === 'MATCHING')
      const monthlyRevenue = cases
        .filter((c) => c.createdAt >= monthStart && ['FUNDED', 'IN_PROGRESS', 'PROOF', 'COMPLETED', 'RESOLVED'].includes(c.status.toUpperCase()))
        .length * 25000

      setData({
        cases: cases.slice(0, 5),
        newCount: newCases.length,
        activeCount: activeCases.length,
        revenue: monthlyRevenue,
        trustScore: 78,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [currentUser?.id])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const pendingQuotes = data?.cases.filter(
    (c) => ['MATCHING', 'QUOTE'].includes(c.status.toUpperCase())
  ) || []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchDashboard}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Briefcase}
          iconBg="bg-blue-50 text-blue-600"
          label="New Cases"
          value={String(data?.newCount ?? 0)}
          sublabel="Needs your quote"
        />
        <SummaryCard
          icon={Clock}
          iconBg="bg-green-50 text-rezzo-green"
          label="Active Work"
          value={String(data?.activeCount ?? 0)}
          sublabel="In progress now"
        />
        <SummaryCard
          icon={TrendingUp}
          iconBg="bg-amber-50 text-rezzo-gold"
          label="Revenue (MTD)"
          value={formatNaira(data?.revenue ?? 0)}
          sublabel="This month"
        />
        <div className="bg-white rounded-xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-rezzo-green flex items-center justify-center">
              <Shield className="size-4" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Trust Score</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#102A43]">{data?.trustScore ?? 0}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Good standing</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          className="text-sm"
          onClick={() => setProfessionalTab('cases')}
        >
          <FileText className="size-4 mr-2" />
          View New Cases
          {data?.newCount ? (
            <Badge variant="secondary" className="ml-2 bg-rezzo-green/10 text-rezzo-green border-0 text-xs">
              {data.newCount}
            </Badge>
          ) : null}
        </Button>
        <Button
          variant="outline"
          className="text-sm"
          onClick={() => setProfessionalTab('services')}
        >
          <Wrench className="size-4 mr-2" />
          Manage Services
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <div className="lg:col-span-2">
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#102A43]">Recent Cases</h2>
              <button
                onClick={() => setProfessionalTab('cases')}
                className="text-xs text-rezzo-green font-medium hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="size-3" />
              </button>
            </div>
            {data?.cases.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No cases yet</p>
                <p className="text-xs text-muted-foreground mt-1">New cases matching your skills will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setProSelectedCaseId(c.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[#102A43]">{c.caseNumber}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {c.title || c.matter?.title || 'Untitled Case'}
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Pending Quotes */}
        <div>
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#102A43]">Needs Attention</h2>
              <Badge variant="secondary" className="bg-rezzo-gold/10 text-rezzo-gold border-0 text-xs">
                {pendingQuotes.length}
              </Badge>
            </div>
            {pendingQuotes.length === 0 ? (
              <div className="text-center py-6">
                <Shield className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">No pending actions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingQuotes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setProSelectedCaseId(c.id)}
                    className="w-full p-3 rounded-lg border border-rezzo-gold/20 bg-rezzo-gold/5 hover:bg-rezzo-gold/10 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[#102A43]">{c.caseNumber}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.title || c.matter?.title || 'Send a quote'}
                    </p>
                    <p className="text-xs text-rezzo-gold font-medium mt-1">Action required</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  iconBg,
  label,
  value,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  label: string
  value: string
  sublabel: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="size-4" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#102A43]">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
    </Card>
  )
}
