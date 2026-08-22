'use client'

import { useState, useCallback } from 'react'
import { apiPost } from '@/store/rezzo-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, Loader2, Search, Shield, CheckCircle2, Clock, AlertCircle, ArrowRight, LogIn } from 'lucide-react'
import { toast } from 'sonner'

// ─── Status Display Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2; desc: string }> = {
  NEW: { label: 'Case Created', color: 'bg-[#F0F4F8] text-[#52606D]', icon: Clock, desc: 'Your case has been received. REZZO AI is analyzing your need.' },
  UNDERSTANDING: { label: 'AI Analyzing', color: 'bg-[#FEF5E7] text-[#B7791F]', icon: Search, desc: 'Our AI is understanding your problem and determining the best resolution path.' },
  CLARIFICATION: { label: 'Needs Clarification', color: 'bg-[#FEF5E7] text-[#B7791F]', icon: AlertCircle, desc: 'REZZO needs a bit more information to match you with the right professional.' },
  CONFIRMATION: { label: 'Awaiting Your Confirmation', color: 'bg-[#FEF5E7] text-[#B7791F]', icon: AlertCircle, desc: 'REZZO has finished analyzing your case and is waiting for you to confirm its understanding.' },
  ROUTED: { label: 'Routed', color: 'bg-[#E8F0FE] text-[#2B6CB0]', icon: ArrowRight, desc: 'Your case has been routed to the right service category.' },
  MATCHING: { label: 'Finding Professionals', color: 'bg-[#E8F0FE] text-[#2B6CB0]', icon: Search, desc: 'We are matching you with the best verified professionals for your need.' },
  QUOTE: { label: 'Awaiting Quotes', color: 'bg-[#FEF7E0] text-[#E0A23A]', icon: Clock, desc: 'Professionals are reviewing your case and preparing quotes.' },
  ACCEPTED: { label: 'Quote Accepted', color: 'bg-[#E6F7F0] text-[#1F7A5A]', icon: CheckCircle2, desc: 'You accepted a quote. The next step is payment.' },
  PAYMENT: { label: 'Payment Pending', color: 'bg-[#FEF7E0] text-[#E0A23A]', icon: Clock, desc: 'Please complete the payment to proceed with your case.' },
  FUNDED: { label: 'Payment Confirmed', color: 'bg-[#E6F7F0] text-[#1F7A5A]', icon: CheckCircle2, desc: 'Payment received and held securely. Service will begin shortly.' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-[#E6F7F0] text-[#1F7A5A]', icon: Clock, desc: 'Your professional is working on your case right now.' },
  PROOF: { label: 'Proof Submitted', color: 'bg-[#E8F0FE] text-[#2B6CB0]', icon: CheckCircle2, desc: 'The professional has submitted proof of work. Review it now.' },
  CUSTOMER_REVIEW: { label: 'Your Review Needed', color: 'bg-[#FEF7E0] text-[#E0A23A]', icon: AlertCircle, desc: 'Please review the completed work and confirm satisfaction.' },
  COMPLETED: { label: 'Completed', color: 'bg-[#E6F7F0] text-[#1F7A5A]', icon: CheckCircle2, desc: 'The service has been completed successfully.' },
  RESOLVED: { label: 'Resolved', color: 'bg-[#D4EDDA] text-[#1F7A5A]', icon: CheckCircle2, desc: 'Your case has been resolved. Thank you for using REZZO!' },
  DISPUTED: { label: 'Disputed', color: 'bg-[#FDE8E8] text-[#C23B3B]', icon: AlertCircle, desc: 'A dispute has been opened. Our team will review and mediate.' },
  CANCELLED: { label: 'Cancelled', color: 'bg-[#F0F4F8] text-[#52606D]', icon: X, desc: 'This case was cancelled.' },
  ESCALATED: { label: 'Escalated', color: 'bg-[#FDE8E8] text-[#C23B3B]', icon: AlertCircle, desc: 'This case has been escalated for special handling.' },
}

// ─── Event Type Labels ───────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  CASE_CREATED: 'Case Created',
  AI_UNDERSTANDING: 'AI Started Analysis',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
  ROUTE_SELECTED: 'Route Determined',
  MATCHES_GENERATED: 'Professionals Matched',
  QUOTE_RECEIVED: 'Quote Received',
  QUOTE_ACCEPTED: 'Quote Accepted',
  PAYMENT_INITIATED: 'Payment Initiated',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  SERVICE_STARTED: 'Service Started',
  PROOF_SUBMITTED: 'Proof of Work Submitted',
  CUSTOMER_APPROVED: 'Customer Approved',
  CASE_COMPLETED: 'Case Completed',
  CASE_RESOLVED: 'Case Resolved',
  DISPUTE_OPENED: 'Dispute Opened',
  ESCALATED: 'Case Escalated',
  CASE_CANCELLED: 'Case Cancelled',
}

interface GuestCaseData {
  case: {
    id: string
    caseNumber: string
    status: string
    vertical?: string | null
    location?: string | null
    state?: string | null
    priority: string
    createdAt: string
    updatedAt: string
    resolvedAt?: string | null
  }
  need: { title: string; rawInput?: string; desiredOutcome?: string | null } | null
  matter: { summary?: string | null; categoryId?: string | null; urgency?: string | null } | null
  events: Array<{ id: string; eventType: string; actorType: string; createdAt: string; payload: unknown }>
  quotes: Array<{ id: string; status: string; amount: number; currency: string; professionalName: string; createdAt: string; expiresAt?: string | null }>
  payments: Array<{ id: string; status: string; amount: number; currency: string; createdAt: string }>
  participantCount: number
  assignedProfessional: { name: string } | null
}

interface GuestPortalProps {
  onClose: () => void
}

export function GuestPortal({ onClose }: GuestPortalProps) {
  const [step, setStep] = useState<'lookup' | 'result'>('lookup')
  const [caseNumber, setCaseNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<GuestCaseData | null>(null)
  const [showAllEvents, setShowAllEvents] = useState(false)

  const handleLookup = useCallback(async () => {
    if (!caseNumber.trim() || !phone.trim()) {
      setError('Please enter both your case number and phone number')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost<GuestCaseData>('/guest/lookup', {
        caseNumber: caseNumber.trim(),
        phone: phone.trim(),
      })
      setCaseData(data)
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup case. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }, [caseNumber, phone])

  const handleReset = () => {
    setStep('lookup')
    setCaseData(null)
    setShowAllEvents(false)
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'NGN') return `\u20a6${amount.toLocaleString()}`
    return `${currency} ${amount.toLocaleString()}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Full-screen on mobile, modal on desktop */}
      <div className="relative bg-[#F7F9FB] w-full sm:max-w-lg sm:rounded-2xl shadow-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1F7A5A]/10 flex items-center justify-center">
              {step === 'lookup' ? (
                <Search className="size-4 text-[#1F7A5A]" />
              ) : (
                <Shield className="size-4 text-[#1F7A5A]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#102A43]">
                {step === 'lookup' ? 'Guest Portal' : `Case ${caseData?.case.caseNumber}`}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {step === 'lookup' ? 'Track your case without logging in' : 'Case status & updates'}
              </p>
            </div>
          </div>
          <button
            className="p-1.5 rounded-lg hover:bg-muted/50"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'lookup' ? (
            <LookupView
              caseNumber={caseNumber}
              setCaseNumber={setCaseNumber}
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              error={error}
              setError={setError}
              onLookup={handleLookup}
            />
          ) : caseData ? (
            <ResultView
              data={caseData}
              showAllEvents={showAllEvents}
              setShowAllEvents={setShowAllEvents}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onReset={handleReset}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Lookup View ─────────────────────────────────────────────────────────────
function LookupView({
  caseNumber, setCaseNumber, phone, setPhone, loading, error, setError, onLookup,
}: {
  caseNumber: string
  setCaseNumber: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  loading: boolean
  error: string | null
  setError: (v: string | null) => void
  onLookup: () => void
}) {
  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1F7A5A]/10 flex items-center justify-center mx-auto mb-4">
          <Shield className="size-8 text-[#1F7A5A]" />
        </div>
        <h3 className="text-lg font-semibold text-[#102A43]">Track Your Case</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
          Enter your case number and the phone number you used to create the case. We&apos;ll show you the current status and all updates.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Case Number</label>
          <input
            type="text"
            value={caseNumber}
            onChange={(e) => { setCaseNumber(e.target.value); setError(null) }}
            placeholder="e.g. RZ-000042"
            className="h-11 w-full rounded-xl border border-input bg-white px-4 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none uppercase"
            disabled={loading}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null) }}
            placeholder="The phone number you registered with"
            className="h-11 w-full rounded-xl border border-input bg-white px-4 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && onLookup()}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rezzo-danger/5 border border-rezzo-danger/20">
            <AlertCircle className="size-4 text-rezzo-danger shrink-0 mt-0.5" />
            <p className="text-xs text-rezzo-danger leading-relaxed">{error}</p>
          </div>
        )}

        <Button
          className="w-full h-12 rounded-xl bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white font-semibold text-sm mt-1"
          disabled={loading || !caseNumber.trim() || !phone.trim()}
          onClick={onLookup}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Look Up My Case'}
        </Button>
      </div>

      <div className="text-center pt-2">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Your information is only used to verify case ownership and is not stored.
        </p>
      </div>
    </div>
  )
}

// ─── Result View ─────────────────────────────────────────────────────────────
function ResultView({
  data, showAllEvents, setShowAllEvents, formatCurrency, formatDate, onReset,
}: {
  data: GuestCaseData
  showAllEvents: boolean
  setShowAllEvents: (v: boolean) => void
  formatCurrency: (a: number, c: string) => string
  formatDate: (d: string) => string
  onReset: () => void
}) {
  const statusCfg = STATUS_CONFIG[data.case.status] || STATUS_CONFIG.NEW
   const StatusIcon = statusCfg.icon
  const displayEvents = showAllEvents ? data.events : data.events.slice(0, 5)

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Status Banner */}
      <div className={`${statusCfg.color} rounded-xl p-4 flex items-start gap-3`}>
        <StatusIcon className="size-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">{statusCfg.label}</p>
          <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{statusCfg.desc}</p>
        </div>
      </div>

      {/* Case Info */}
      <Card className="p-4 rounded-xl">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Case Details</h4>
        <div className="flex flex-col gap-2.5">
          {data.need && (
            <div>
              <p className="text-sm font-medium text-[#102A43]">{data.need.title}</p>
              {data.need.rawInput && data.need.rawInput !== data.need.title && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{data.need.rawInput}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium text-[#102A43] mt-0.5">{data.case.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Priority</span>
              <p className="font-medium text-[#102A43] mt-0.5">{data.case.priority}</p>
            </div>
            {data.case.location && (
              <div>
                <span className="text-muted-foreground">Location</span>
                <p className="font-medium text-[#102A43] mt-0.5">{data.case.location}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium text-[#102A43] mt-0.5">{formatDate(data.case.createdAt)}</p>
            </div>
          </div>
          {data.assignedProfessional && (
            <div className="border-t border-border/60 pt-2.5 mt-1">
              <span className="text-xs text-muted-foreground">Assigned Professional</span>
              <p className="text-sm font-medium text-[#1F7A5A] mt-0.5">{data.assignedProfessional.name}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Quotes */}
      {data.quotes.length > 0 && (
        <Card className="p-4 rounded-xl">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quotes ({data.quotes.length})</h4>
          <div className="flex flex-col gap-2.5">
            {data.quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#102A43]">{q.professionalName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#102A43]">{formatCurrency(q.amount, q.currency)}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    q.status === 'ACCEPTED' ? 'bg-[#1F7A5A]/10 text-[#1F7A5A]' :
                    q.status === 'PENDING' ? 'bg-[#E0A23A]/10 text-[#E0A23A]' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {q.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Payments */}
      {data.payments.length > 0 && (
        <Card className="p-4 rounded-xl">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payments</h4>
          <div className="flex flex-col gap-2.5">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#102A43]">{formatCurrency(p.amount, p.currency)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  p.status === 'CONFIRMED' || p.status === 'COMPLETED' ? 'bg-[#1F7A5A]/10 text-[#1F7A5A]' :
                  p.status === 'PENDING' ? 'bg-[#E0A23A]/10 text-[#E0A23A]' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card className="p-4 rounded-xl">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity Timeline</h4>
        {data.events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-0">
            {displayEvents.map((event, i) => (
              <div key={event.id} className="flex gap-3 relative">
                {/* Timeline line */}
                {i < displayEvents.length - 1 && (
                  <div className="absolute left-[7px] top-[18px] w-px h-[calc(100%-6px)] bg-border/60" />
                )}
                <div className="w-[15px] h-[15px] rounded-full bg-border/80 border-2 border-[#F7F9FB] shrink-0 mt-[3px] z-10" />
                <div className="pb-4 min-w-0">
                  <p className="text-sm font-medium text-[#102A43]">
                    {EVENT_LABELS[event.eventType] || event.eventType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {data.events.length > 5 && !showAllEvents && (
          <button
            className="text-xs text-[#1F7A5A] font-medium mt-2 hover:underline"
            onClick={() => setShowAllEvents(true)}
          >
            Show all {data.events.length} events
          </button>
        )}
      </Card>

      {/* Login CTA */}
      <Card className="p-4 rounded-xl bg-gradient-to-br from-[#102A43]/[0.02] to-transparent border-[#102A43]/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#102A43]/10 flex items-center justify-center shrink-0">
            <LogIn className="size-5 text-[#102A43]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#102A43]">Want full access?</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Log in to message your professional, make payments, upload documents, and manage your case.
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 pb-4">
        <Button
          variant="outline"
          className="flex-1 h-11 rounded-xl text-sm"
          onClick={onReset}
        >
          Look Up Another
        </Button>
        <Button
          className="flex-1 h-11 rounded-xl bg-[#102A43] hover:bg-[#102A43]/90 text-white text-sm font-medium"
          onClick={onReset}
        >
          Refresh Status
        </Button>
      </div>
    </div>
  )
}