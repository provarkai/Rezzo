'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/store/rezzo-store'
import { ShieldCheck } from 'lucide-react'

interface TrustRulesData {
  weights: { SKILL_RELEVANCE: number; TRUST_SCORE: number; LOCATION_MATCH: number; VERIFICATION_TIER: number }
  verificationTierBonus: Record<string, number>
  distribution: Array<{ verificationStatus: string; count: number; avgTrustScore: number; matchingBonus: number }>
}

const WEIGHT_LABELS: Record<string, string> = {
  SKILL_RELEVANCE: 'Skill relevance',
  TRUST_SCORE: 'Trust score',
  LOCATION_MATCH: 'Location match',
  VERIFICATION_TIER: 'Verification tier',
}

export function AdminTrustRules() {
  const [data, setData] = useState<TrustRulesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiGet<TrustRulesData>('/admin/trust-rules')
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trust rules')
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

  const totalWeight = Object.values(data.weights).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <ShieldCheck className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          Read-only — the live weights the matching engine scores professionals with (out of
          {' '}{totalWeight} points total), not a hand-copied duplicate that could drift from
          the actual code.
        </p>
      </div>

      <Card className="p-4 gap-3">
        <h3 className="text-sm font-semibold text-[#102A43]">Matching Weights</h3>
        <div className="flex flex-col gap-2">
          {Object.entries(data.weights).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-32 shrink-0">{WEIGHT_LABELS[key] || key}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-[#1F7A5A]"
                  style={{ width: `${(value / totalWeight) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground w-10 text-right">{value}pt</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 gap-3">
        <h3 className="text-sm font-semibold text-[#102A43]">Professionals by Verification Tier</h3>
        <div className="flex flex-col gap-2">
          {data.distribution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No professionals yet</p>
          ) : (
            data.distribution
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <div key={row.verificationStatus} className="flex items-center justify-between text-sm p-2 rounded-lg border border-border/60">
                  <span className="font-medium text-foreground">{row.verificationStatus}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{row.count} professional{row.count === 1 ? '' : 's'}</span>
                    <span>avg trust {row.avgTrustScore}</span>
                    <span className="text-[#1F7A5A] font-medium">+{row.matchingBonus}pt</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </Card>
    </div>
  )
}
