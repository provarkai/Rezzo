'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRezzoStore, apiGet } from '@/store/rezzo-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, Circle, RefreshCw, Repeat, LogOut, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface CredentialItem {
  id: string
  type: string
  status: string
  issuer?: string | null
}
interface ProfessionalProfile {
  id: string
  verificationStatus: string
  credentials: CredentialItem[]
}

// Rendered by ProfessionalApp in place of the real dashboard whenever
// verification hasn't reached an active tier yet (see isVerificationActive
// in constants.ts). Professional.verificationStatus is itself a staged
// pipeline (PENDING -> NEEDS_INFO or VERIFIED -> TRUSTED/EXPERT, or
// SUSPENDED/REVOKED) — this screen surfaces exactly where an application
// sits, refetched live rather than trusting the copy cached at login/apply.
const STATUS_COPY: Record<string, { headline: string; body: string; tone: 'pending' | 'attention' | 'stopped' }> = {
  PENDING: {
    headline: 'Your application is under review',
    body: "We're verifying your credentials. This usually takes a few business days — you'll be notified the moment a reviewer makes a decision.",
    tone: 'pending',
  },
  NEEDS_INFO: {
    headline: 'We need more information',
    body: 'A reviewer flagged something on your application. Check your email for details, or reach out to support@rezzo.ng.',
    tone: 'attention',
  },
  SUSPENDED: {
    headline: 'Your professional account is suspended',
    body: 'Contact support@rezzo.ng to resolve this before you can accept cases again.',
    tone: 'stopped',
  },
  REVOKED: {
    headline: 'Your application was not approved',
    body: "This decision can be appealed — reach out to support@rezzo.ng if you'd like to submit updated credentials.",
    tone: 'stopped',
  },
}

export function ProfessionalVerificationStatus() {
  const currentUser = useRezzoStore((s) => s.currentUser)
  const updateCurrentUser = useRezzoStore((s) => s.updateCurrentUser)
  const setActiveMode = useRezzoStore((s) => s.setActiveMode)
  const logout = useRezzoStore((s) => s.logout)
  const setCurrentView = useRezzoStore((s) => s.setCurrentView)

  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    if (!currentUser?.professionalId) return
    setLoading(true)
    try {
      const data = await apiGet<{ professional: ProfessionalProfile }>(`/professionals/${currentUser.professionalId}`)
      setProfile(data.professional)
      // Refresh the cached copy too — this may be the first time the
      // account learns it was approved since logging in.
      updateCurrentUser({ verificationStatus: data.professional.verificationStatus })
    } catch {
      toast.error('Could not load your verification status')
    } finally {
      setLoading(false)
    }
  }, [currentUser?.professionalId, updateCurrentUser])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSwitchToCustomer = () => setActiveMode('CUSTOMER')
  const handleLogout = () => {
    logout()
    setCurrentView('landing')
  }

  const status = profile?.verificationStatus || currentUser?.verificationStatus || 'PENDING'
  const copy = STATUS_COPY[status] || STATUS_COPY.PENDING
  // The only statuses that land here are PENDING and the non-active outcomes
  // (NEEDS_INFO/SUSPENDED/REVOKED) — VERIFIED/TRUSTED/EXPERT never reach this
  // screen, ProfessionalApp renders the real dashboard for those instead.
  const decided = status !== 'PENDING'

  const stages = [
    { label: 'Application submitted', done: true },
    { label: 'Credentials under review', done: decided },
    { label: decided ? copy.headline : 'Verified', done: decided },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB] px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-rezzo-gold/10 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="size-5 text-rezzo-gold" />
          </div>
          <h1 className="text-xl font-bold text-rezzo-navy">{copy.headline}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{copy.body}</p>
        </div>

        <Card className="p-5 rounded-2xl flex flex-col gap-3">
          {loading && !profile ? (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </>
          ) : (
            <>
              {stages.map((stage, i) => (
                <div key={i} className="flex items-center gap-3">
                  {stage.done ? (
                    <CheckCircle2 className="size-4 text-rezzo-green shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm ${stage.done ? 'text-rezzo-navy font-medium' : 'text-muted-foreground'}`}>{stage.label}</span>
                </div>
              ))}

              {profile && profile.credentials.length > 0 && (
                <div className="mt-2 pt-3 border-t border-border/60 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credentials</p>
                  {profile.credentials.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{c.type.charAt(0) + c.type.slice(1).toLowerCase()}{c.issuer ? ` — ${c.issuer}` : ''}</span>
                      <span className={`text-xs font-medium ${c.status === 'VERIFIED' ? 'text-rezzo-green' : c.status === 'REJECTED' ? 'text-rezzo-danger' : 'text-rezzo-gold'}`}>
                        {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <Button variant="outline" className="w-full h-11 rounded-xl gap-2" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh status
        </Button>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full rounded-xl h-11 text-sm font-medium border-rezzo-navy/20 text-rezzo-navy hover:bg-rezzo-navy/5 gap-2"
            onClick={handleSwitchToCustomer}
          >
            <Repeat className="size-4" />
            Switch to Customer Account
          </Button>
          <button
            onClick={handleLogout}
            className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rezzo-navy transition-colors"
          >
            <LogOut className="size-3.5" />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
