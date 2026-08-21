'use client'

import { Badge } from '@/components/ui/badge'
import { Shield, Check } from 'lucide-react'

interface TrustScoreProps {
  score: number
  verificationTier?: string
  resolutionRate?: number
  responseTime?: string
  className?: string
}

function getVerificationLabel(tier?: string): string {
  switch (tier) {
    case 'REZZO_VERIFIED': return 'REZZO Verified'
    case 'TRUSTED': return 'Trusted'
    case 'EXPERT': return 'Expert'
    default: return 'Verified'
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-rezzo-green'
  if (score >= 60) return 'text-rezzo-gold'
  return 'text-rezzo-danger'
}

export function TrustScore({
  score,
  verificationTier,
  resolutionRate,
  responseTime,
  className = '',
}: TrustScoreProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Shield className={`size-5 ${getScoreColor(score)}`} />
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>

      {verificationTier && (
        <Badge
          variant="outline"
          className="w-fit border-rezzo-green/30 bg-rezzo-green/5 text-rezzo-green text-xs gap-1"
        >
          <Check className="size-3" />
          {getVerificationLabel(verificationTier)}
        </Badge>
      )}

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {resolutionRate !== undefined && (
          <div className="flex justify-between">
            <span>Resolution Rate</span>
            <span className="font-medium text-foreground">{resolutionRate}%</span>
          </div>
        )}
        {responseTime && (
          <div className="flex justify-between">
            <span>Avg. Response</span>
            <span className="font-medium text-foreground">{responseTime}</span>
          </div>
        )}
      </div>
    </div>
  )
}
