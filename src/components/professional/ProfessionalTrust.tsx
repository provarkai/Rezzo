'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { TrustScore } from '@/components/rezzo/TrustScore'
import { Badge } from '@/components/ui/badge'
import { apiGet, extractList } from '@/store/rezzo-store'
import {
  Shield,
  CheckCircle2,
  Circle,
  Clock,
  Star,
  Award,
  TrendingUp,
} from 'lucide-react'

interface VerificationCheck {
  label: string
  completed: boolean
  detail?: string
}

interface TrustData {
  score: number
  verificationTier: string
  resolutionRate: number
  responseTime: string
  totalCases: number
  completedCases: number
  avgRating: number
}

const VERIFICATION_CHECKLIST: VerificationCheck[] = [
  { label: 'Identity Verification', completed: true, detail: 'BVN verified' },
  { label: 'Professional Credentials', completed: true, detail: 'Certificates uploaded' },
  { label: 'Address Verification', completed: true, detail: 'Utility bill verified' },
  { label: 'Skills Assessment', completed: true, detail: 'Passed assessment' },
  { label: 'Background Check', completed: false, detail: 'Pending review' },
]

export function ProfessionalTrust() {
  const [data, setData] = useState<TrustData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrust = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const cases = extractList<{ status: string }>(await apiGet('/cases'), 'cases')
      const total = cases.length
      const completed = cases.filter((c) =>
        ['COMPLETED', 'RESOLVED'].includes(c.status.toUpperCase())
      ).length
      const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0

      setData({
        score: 78,
        verificationTier: 'REZZO_VERIFIED',
        resolutionRate,
        responseTime: '2h 15m',
        totalCases: total,
        completedCases: completed,
        avgRating: 4.7,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trust data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrust()
  }, [fetchTrust])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchTrust}>
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Verification Status Card */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="size-4 text-rezzo-green" />
          <h2 className="text-sm font-semibold text-[#102A43]">
            Verification Status
          </h2>
          <Badge
            variant="outline"
            className="ml-auto border-rezzo-green/30 bg-rezzo-green/5 text-rezzo-green text-xs"
          >
            <CheckCircle2 className="size-3 mr-1" />
            Verified
          </Badge>
        </div>
        <div className="space-y-3">
          {VERIFICATION_CHECKLIST.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-3">
                {check.completed ? (
                  <CheckCircle2 className="size-4 text-rezzo-green shrink-0" />
                ) : (
                  <Circle className="size-4 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p
                    className={`text-sm ${
                      check.completed
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {check.label}
                  </p>
                  {check.detail && (
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  )}
                </div>
              </div>
              {check.completed ? (
                <span className="text-xs text-rezzo-green font-medium">Done</span>
              ) : (
                <span className="text-xs text-rezzo-gold font-medium">Pending</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Trust Score */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="size-4 text-rezzo-gold" />
            <h2 className="text-sm font-semibold text-[#102A43]">Trust Score</h2>
          </div>
          {data && (
            <TrustScore
              score={data.score}
              verificationTier={data.verificationTier}
              resolutionRate={data.resolutionRate}
              responseTime={data.responseTime}
            />
          )}
          <Separator className="my-4" />
          <div className="space-y-3">
            <TrustDimension
              label="Verification"
              value={85}
              color="bg-rezzo-green"
            />
            <TrustDimension
              label="Case Outcomes"
              value={72}
              color="bg-rezzo-green"
            />
            <TrustDimension
              label="Reviews"
              value={80}
              color="bg-rezzo-gold"
            />
            <TrustDimension
              label="Responsiveness"
              value={75}
              color="bg-rezzo-gold"
            />
          </div>
        </Card>

        {/* Performance Metrics */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-rezzo-green" />
            <h2 className="text-sm font-semibold text-[#102A43]">
              Performance Metrics
            </h2>
          </div>
          {data && (
            <div className="space-y-4">
              <MetricRow
                icon={Shield}
                label="Total Cases"
                value={String(data.totalCases)}
              />
              <MetricRow
                icon={CheckCircle2}
                label="Completed"
                value={String(data.completedCases)}
              />
              <MetricRow
                icon={TrendingUp}
                label="Resolution Rate"
                value={`${data.resolutionRate}%`}
              />
              <MetricRow
                icon={Clock}
                label="Avg Response Time"
                value={data.responseTime}
              />
              <MetricRow
                icon={Star}
                label="Avg Rating"
                value={`${data.avgRating}/5`}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function TrustDimension({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium text-foreground">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-[#102A43]">{value}</span>
    </div>
  )
}
