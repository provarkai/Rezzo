'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/store/rezzo-store'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { BarChart3 } from 'lucide-react'

interface AnalyticsData {
  totalCases: number
  gmv: number
  revenue: number
  resolutionRate: number
  avgResolutionTime: string
  disputedCases: number
  newCasesToday: number
  funnel: {
    quoteRate: number
    quoteAcceptanceRate: number
    paymentConversionRate: number
    disputeRate: number
  }
}

const FUNNEL_STAGES = [
  { key: 'quoteRate', label: 'Cases that reached a quote', of: 'of cases created' },
  { key: 'quoteAcceptanceRate', label: 'Quotes accepted', of: 'of quotes sent' },
  { key: 'paymentConversionRate', label: 'Accepted quotes that got funded', of: 'of accepted quotes' },
] as const

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiGet<AnalyticsData>('/admin/analytics')
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  if (error || !data) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error || 'Failed to load'}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <BarChart3 className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          Real conversion rates computed from Case/Quote/Payment/Dispute records — PRD §22.2's
          Marketplace, Transactions and Resolution KPI groups. Overview shows the same underlying
          numbers as day-to-day totals; this is the funnel view.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="GMV" value={formatNaira(data.gmv)} />
        <StatCard label="REZZO Revenue" value={formatNaira(data.revenue)} color="text-rezzo-green" />
        <StatCard label="Resolution Rate" value={`${data.resolutionRate}%`} />
        <StatCard label="Avg Time to Resolution" value={data.avgResolutionTime} />
        <StatCard label="Dispute Rate" value={`${data.funnel.disputeRate}%`} color={data.funnel.disputeRate > 10 ? 'text-rezzo-danger' : undefined} />
        <StatCard label="New Cases Today" value={String(data.newCasesToday)} />
      </div>

      <Card className="p-4 gap-4">
        <h3 className="text-sm font-semibold text-[#102A43]">Conversion Funnel</h3>
        <div className="flex flex-col gap-3">
          {FUNNEL_STAGES.map((stage) => {
            const value = data.funnel[stage.key]
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-48 shrink-0">
                  <p className="text-xs font-medium text-foreground">{stage.label}</p>
                  <p className="text-[10px] text-muted-foreground">{stage.of}</p>
                </div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-[#1F7A5A]" style={{ width: `${Math.min(value, 100)}%` }} />
                </div>
                <span className="text-sm font-semibold text-[#102A43] w-12 text-right">{value}%</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ label, value, color = 'text-[#102A43]' }: { label: string; value: string; color?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] text-muted-foreground font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </Card>
  )
}
