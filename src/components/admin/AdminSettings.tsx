'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { apiGet } from '@/store/rezzo-store'
import { Settings, CheckCircle2, XCircle } from 'lucide-react'

interface SettingsData {
  commissionRate: number
  currency: string
  providers: { paystack: boolean; whatsapp: boolean }
}

export function AdminSettings() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiGet<SettingsData>('/admin/settings')
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  if (error || !data) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error || 'Failed to load'}</p>
        <Button variant="outline" size="sm" onClick={fetchSettings}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <Settings className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          Read-only — there's no editable settings store in V1. These are the real values
          currently in effect from environment variables and constants, not a form that saves
          anywhere.
        </p>
      </div>

      <Card className="p-4 gap-3">
        <h3 className="text-sm font-semibold text-[#102A43]">Platform</h3>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Commission rate</span>
          <span className="font-medium text-foreground">{(data.commissionRate * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Currency</span>
          <span className="font-medium text-foreground">{data.currency}</span>
        </div>
      </Card>

      <Card className="p-4 gap-3">
        <h3 className="text-sm font-semibold text-[#102A43]">Integrations</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Paystack (payments)</span>
          {data.providers.paystack ? (
            <Badge className="border-0 text-xs bg-rezzo-green/10 text-rezzo-green gap-1">
              <CheckCircle2 className="size-3" /> Configured
            </Badge>
          ) : (
            <Badge className="border-0 text-xs bg-muted text-muted-foreground gap-1">
              <XCircle className="size-3" /> Not configured (MOCK)
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">WhatsApp</span>
          {data.providers.whatsapp ? (
            <Badge className="border-0 text-xs bg-rezzo-green/10 text-rezzo-green gap-1">
              <CheckCircle2 className="size-3" /> Configured
            </Badge>
          ) : (
            <Badge className="border-0 text-xs bg-muted text-muted-foreground gap-1">
              <XCircle className="size-3" /> Not configured
            </Badge>
          )}
        </div>
      </Card>
    </div>
  )
}
