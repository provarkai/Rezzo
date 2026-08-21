'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRezzoStore, apiGet, apiPost } from '@/store/rezzo-store'
import { StatusBadge } from '@/components/rezzo/StatusBadge'
import { TrustScore } from '@/components/rezzo/TrustScore'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronLeft,
  Check,
  Clock,
  MapPin,
  Star,
  X,
  AlertCircle,
  Send,
  Loader2,
  Shield,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'

/* ---------- types ---------- */
interface TimelineEvent {
  id: string
  type: string
  description: string
  createdAt: string
  metadata?: Record<string, unknown>
}

interface Message {
  id: string
  body: string
  senderId: string
  senderName?: string
  senderRole?: string
  createdAt: string
}

interface Quote {
  id: string
  scope: string
  totalAmount: number
  timeline: string
  terms: string
  status: string
  expiresAt?: string
  professional?: {
    id: string
    name: string
    businessName?: string
  }
}

interface Payment {
  id: string
  amount: number
  rezzoFee: number
  totalAmount: number
  status: string
  createdAt: string
}

interface Match {
  id: string
  name: string
  businessName?: string
  specialty?: string
  trustScore: number
  verificationTier?: string
  resolutionRate?: number
  responseTime?: string
  minPrice?: number
  maxPrice?: number
  explanation?: string
  distance?: number
}

interface Proof {
  id: string
  type: string
  description: string
  createdAt: string
}

interface Booking {
  id: string
  startsAt?: string
  endsAt?: string
  location?: string
  status: string
  confirmedAt?: string
}

interface CaseDetail {
  id: string
  caseNumber: string
  status: string
  priority: string
  protectionStatus?: string
  createdAt: string
  updatedAt: string
  need?: {
    title?: string
    description?: string
    location?: string
    category?: string
    vertical?: string
  }
  matter?: {
    summary?: string
    category?: string
    confidence?: number
    requiredDocuments?: string[]
    estimatedComplexity?: string
  }
  events?: TimelineEvent[]
  messages?: Message[]
  quotes?: Quote[]
  payments?: Payment[]
  proofs?: Proof[]
  bookings?: Booking[]
  review?: {
    id: string
    rating: number
    comment: string
  }
  professional?: {
    id: string
    name: string
    businessName?: string
  }
}

/* ---------- helpers ---------- */
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getEventIcon(type: string) {
  switch (type) {
    case 'CASE_CREATED': return '🆕'
    case 'AI_ORCHESTRATED': return '🤖'
    case 'AI_UNDERSTANDING_READY': return '🧭'
    case 'MATCHED': return '🎯'
    case 'QUOTE_RECEIVED': return '📝'
    case 'QUOTE_ACCEPTED': return '✅'
    case 'PAYMENT_INITIATED': return '💳'
    case 'PAYMENT_CONFIRMED': return '💰'
    case 'FUNDED': return '🟢'
    case 'WORK_STARTED': return '🔧'
    case 'PROOF_SUBMITTED': return '📸'
    case 'RESOLVED': return '🎉'
    case 'DISPUTE_OPENED': return '⚠️'
    default: return '📌'
  }
}

/* ---------- component ---------- */
export function CaseWorkspace() {
  const caseId = useRezzoStore((s) => s.selectedCaseId)
  const setSelectedCaseId = useRezzoStore((s) => s.setSelectedCaseId)
  const currentUser = useRezzoStore((s) => s.currentUser)

  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Review form state
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // Message state
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // Confirm-understanding state
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionText, setCorrectionText] = useState('')

  const fetchCase = useCallback(async () => {
    if (!caseId) return
    try {
      setLoading(true)
      setError(null)
      const raw = await apiGet<{ case: Record<string, unknown>; need?: Record<string, unknown>; matter?: Record<string, unknown>; events?: Record<string, unknown>[]; quotes?: Record<string, unknown>[]; payments?: Record<string, unknown>[]; proofItems?: Record<string, unknown>[]; bookings?: Record<string, unknown>[]; messages?: Record<string, unknown>[]; reviews?: Record<string, unknown>[] }>(`/cases/${caseId}`)
      // Flatten the nested response into CaseDetail shape
      const c = raw.case as unknown as CaseDetail
      c.need = raw.need as CaseDetail['need']
      c.matter = raw.matter as CaseDetail['matter']
      c.events = (raw.events || []).map((e: Record<string, unknown>) => ({
        id: String(e.id),
        type: String(e.eventType || e.type || ''),
        description: String(e.eventType || ''),
        createdAt: String(e.createdAt || ''),
        metadata: (e.payload || {}) as Record<string, unknown>,
      })) as unknown as CaseDetail['events']
      c.messages = (raw.messages || []).map((m: Record<string, unknown>) => ({
        id: String(m.id),
        body: String(m.body || ''),
        senderId: String(m.senderId || ''),
        senderName: String((m.sender as Record<string, unknown>)?.profile?.displayName || (m.sender as Record<string, unknown>)?.profile?.name || ''),
        senderRole: String((m.sender as Record<string, unknown>)?.role || ''),
        createdAt: String(m.createdAt || ''),
      })) as unknown as CaseDetail['messages']
      c.quotes = (raw.quotes || []).map((q: Record<string, unknown>) => ({
        id: String(q.id),
        scope: String(q.scope || ''),
        totalAmount: Number(q.totalAmount || 0),
        timeline: String(q.timeline || ''),
        terms: String(q.terms || ''),
        status: String(q.status || ''),
        expiresAt: q.expiresAt ? String(q.expiresAt) : undefined,
        professional: q.professional ? {
          id: String((q.professional as Record<string, unknown>).id || ''),
          name: String((q.professional as Record<string, unknown>).user?.profile?.displayName || (q.professional as Record<string, unknown>).user?.profile?.name || ''),
        } : undefined,
      })) as unknown as CaseDetail['quotes']
      c.payments = (raw.payments || []).map((p: Record<string, unknown>) => ({
        id: String(p.id),
        amount: Number(p.grossAmount || 0),
        rezzoFee: Number(p.commissionAmount || 0),
        totalAmount: Number(p.grossAmount || 0),
        status: String(p.status || ''),
        createdAt: String(p.createdAt || ''),
      })) as unknown as CaseDetail['payments']
      c.proofs = (raw.proofItems || []).map((p: Record<string, unknown>) => ({
        id: String(p.id),
        type: String(p.type || 'PHOTO'),
        description: String(p.description || ''),
        status: String(p.status || 'PENDING'),
        createdAt: String(p.createdAt || ''),
      })) as unknown as CaseDetail['proofs']
      c.bookings = (raw.bookings || []).map((b: Record<string, unknown>) => ({
        id: String(b.id),
        startsAt: b.startsAt ? String(b.startsAt) : undefined,
        endsAt: b.endsAt ? String(b.endsAt) : undefined,
        location: b.location ? String(b.location) : undefined,
        status: String(b.status || 'SCHEDULED'),
        confirmedAt: b.confirmedAt ? String(b.confirmedAt) : undefined,
      })) as unknown as CaseDetail['bookings']
      setCaseData(c)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  const fetchMatches = useCallback(async () => {
    if (!caseId) return
    try {
      const data = await apiGet<{ matches: Match[] }>(`/cases/${caseId}/matches`)
      setMatches(data.matches || [])
    } catch {
      setMatches([])
    }
  }, [caseId])

  const fetchMessages = useCallback(async () => {
    if (!caseId) return
    try {
      const data = await apiGet<{ messages: Message[] }>(`/cases/${caseId}/messages`)
      setMessages(data.messages || [])
    } catch {
      setMessages([])
    }
  }, [caseId])

  const fetchTimeline = useCallback(async () => {
    if (!caseId) return
    try {
      const data = await apiGet<{ events: TimelineEvent[] }>(`/cases/${caseId}/timeline`)
      setTimeline(data.events || [])
    } catch {
      setTimeline([])
    }
  }, [caseId])

  useEffect(() => {
    fetchCase()
  }, [fetchCase])

  useEffect(() => {
    if (!caseData) return
    const status = caseData.status.toUpperCase()
    if (status === 'MATCHING' || status === 'QUOTE') {
      fetchMatches()
    }
    if (['FUNDED', 'IN_PROGRESS', 'PROOF', 'CUSTOMER_REVIEW', 'RESOLVED'].includes(status)) {
      fetchTimeline()
      fetchMessages()
    }
  }, [caseData, fetchMatches, fetchMessages, fetchTimeline])

  const refreshAll = useCallback(async () => {
    await fetchCase()
    await fetchMatches()
    await fetchMessages()
    await fetchTimeline()
  }, [fetchCase, fetchMatches, fetchMessages, fetchTimeline])

  const handleBack = () => {
    setSelectedCaseId(null)
  }

  const handleConfirmUnderstanding = async (confirmed: boolean) => {
    if (!confirmed && !correctionText.trim()) {
      setShowCorrection(true)
      return
    }
    setActionLoading('confirm')
    try {
      await apiPost(`/cases/${caseId}/confirm-understanding`, {
        confirmed,
        correction: confirmed ? undefined : correctionText.trim(),
      })
      toast.success(confirmed ? 'Thanks — finding matches now' : 'Got it, let me take another look')
      setShowCorrection(false)
      setCorrectionText('')
      await refreshAll()
    } catch (err) {
      toast.error('Something went wrong', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptQuote = async (quoteId: string) => {
    setActionLoading(quoteId)
    try {
      await apiPost(`/quotes/${quoteId}/accept`)
      toast.success('Quote accepted!')
      await refreshAll()
    } catch (err) {
      toast.error('Failed to accept quote', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handlePay = async (quoteId: string) => {
    setActionLoading('payment')
    try {
      const payment = await apiPost<{ id: string; paymentIntentId?: string }>(
        `/cases/${caseId}/payment-intent`,
        { quoteId }
      )
      // Auto-confirm (simulating webhook)
      await apiPost(`/payments/${payment.id}/confirm`)
      toast.success('Payment successful!')
      await refreshAll()
    } catch (err) {
      toast.error('Payment failed', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmBooking = async (bookingId: string) => {
    setActionLoading('booking-confirm')
    try {
      await apiPost(`/bookings/${bookingId}/confirm`)
      toast.success('Appointment confirmed')
      await refreshAll()
    } catch (err) {
      toast.error('Could not confirm the appointment', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeclineBooking = async (bookingId: string) => {
    setActionLoading('booking-decline')
    try {
      await apiPost(`/bookings/${bookingId}/cancel`)
      toast.success('Appointment declined — the professional can propose a new time')
      await refreshAll()
    } catch (err) {
      toast.error('Could not decline the appointment', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleResolve = async () => {
    setActionLoading('resolve')
    try {
      await apiPost(`/cases/${caseId}/resolve`, {})
      toast.success('Resolution approved! Thank you.')
      await refreshAll()
    } catch (err) {
      toast.error('Failed to approve resolution', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      toast.error('Please select a rating')
      return
    }
    if (!caseData?.professional?.id) {
      toast.error('No professional to review')
      return
    }
    setReviewSubmitting(true)
    try {
      await apiPost(`/cases/${caseId}/reviews`, {
        professionalId: caseData.professional.id,
        rating: reviewRating,
        comment: reviewComment,
      })
      toast.success('Review submitted! Thank you.')
      setReviewRating(0)
      setReviewComment('')
      await refreshAll()
    } catch (err) {
      toast.error('Failed to submit review', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    setSendingMessage(true)
    try {
      await apiPost(`/cases/${caseId}/messages`, { body: newMessage.trim() })
      setNewMessage('')
      await fetchMessages()
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleRequestQuote = async (proName: string) => {
    toast.success('Quote request sent', { description: `${proName} will respond shortly` })
  }

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FB]">
        <div className="sticky top-0 bg-white border-b border-border/60 px-4 py-3">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="px-4 pt-4 flex flex-col gap-4 max-w-lg mx-auto">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  /* ---------- Error state ---------- */
  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-[#F7F9FB]">
        <div className="sticky top-0 bg-white border-b border-border/60 px-4 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-4">
          <AlertCircle className="size-10 text-rezzo-danger" />
          <p className="text-sm text-center text-muted-foreground">{error || 'Case not found'}</p>
          <Button variant="outline" size="sm" onClick={handleBack}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const status = caseData.status.toUpperCase()
  const need = caseData.need
  const matter = caseData.matter
  const quotes = caseData.quotes || []
  const payments = caseData.payments || []
  const proofs = caseData.proofs || []
  const acceptedQuote = quotes.find((q) => q.status.toUpperCase() === 'ACCEPTED')
  const latestPayment = payments[payments.length - 1]

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to cases"
          >
            <ChevronLeft className="size-5" />
            <span>Back</span>
          </button>
          <span className="text-sm font-semibold text-[#102A43]">{caseData.caseNumber}</span>
          <StatusBadge status={caseData.status} />
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-32 flex flex-col gap-4">

          {/* Case Header Card */}
          <Card className="p-4 gap-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-[#102A43] line-clamp-2">
                  {need?.title || 'Untitled Case'}
                </h2>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDate(caseData.createdAt)}
                  </span>
                  {need?.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {need.location}
                    </span>
                  )}
                </div>
              </div>
              {caseData.priority && (
                <Badge
                  variant="outline"
                  className="shrink-0 text-xs border-rezzo-gold/40 bg-rezzo-gold/5 text-rezzo-gold"
                >
                  {caseData.priority}
                </Badge>
              )}
            </div>
            {caseData.protectionStatus === 'PROTECTED' && (
              <div className="flex items-start gap-1.5 pt-2 border-t border-border/60">
                <Shield className="size-3.5 text-[#1F7A5A] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-[#1F7A5A]">REZZO Protected Case</span>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Your payment, proof and dispute history are tied to this case.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* AI REZZO Summary */}
          {matter && (
            <Card className="p-4 gap-3 border-[#1F7A5A]/20 bg-[#1F7A5A]/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg rezzo-green-gradient flex items-center justify-center">
                  <span className="text-white text-xs font-bold">R</span>
                </div>
                <span className="text-sm font-semibold text-[#1F7A5A]">REZZO Analysis</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {matter.summary || 'Analyzing your need...'}
              </p>
              {matter.category && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {matter.category}
                  </span>
                  {matter.estimatedComplexity && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {matter.estimatedComplexity}
                    </span>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* ===== CONFIRMATION: Customer confirms/corrects AI's understanding ===== */}
          {status === 'CONFIRMATION' && (
            <Card className="p-4 gap-3">
              <p className="text-sm font-semibold text-[#102A43]">Is this correct?</p>
              <p className="text-xs text-muted-foreground -mt-1.5">
                Confirm what REZZO understood above, or tell us what's off so we can take another look.
              </p>
              {!showCorrection ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white rounded-xl h-11 text-sm font-semibold"
                    disabled={actionLoading === 'confirm'}
                    onClick={() => handleConfirmUnderstanding(true)}
                  >
                    {actionLoading === 'confirm' ? <Loader2 className="size-4 animate-spin" /> : 'Yes, that\'s right'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-11 text-sm font-semibold"
                    disabled={actionLoading === 'confirm'}
                    onClick={() => setShowCorrection(true)}
                  >
                    Not quite
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    placeholder="What did REZZO get wrong or miss?"
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white rounded-xl h-11 text-sm font-semibold"
                      disabled={actionLoading === 'confirm' || !correctionText.trim()}
                      onClick={() => handleConfirmUnderstanding(false)}
                    >
                      {actionLoading === 'confirm' ? <Loader2 className="size-4 animate-spin" /> : 'Send correction'}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl h-11 text-sm"
                      disabled={actionLoading === 'confirm'}
                      onClick={() => { setShowCorrection(false); setCorrectionText('') }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ===== MATCHING: Show Professionals ===== */}
          {status === 'MATCHING' && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[#102A43]">
                Matched Professionals
              </h3>
              {matches.length === 0 ? (
                <Card className="p-6 flex flex-col items-center gap-2">
                  <Loader2 className="size-5 animate-spin text-[#1F7A5A]" />
                  <p className="text-sm text-muted-foreground">Finding the best professionals for you...</p>
                </Card>
              ) : (
                matches.map((match) => (
                  <Card key={match.id} className="p-4 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#102A43] flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">
                          {match.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#102A43]">{match.name}</p>
                        {match.businessName && (
                          <p className="text-xs text-muted-foreground">{match.businessName}</p>
                        )}
                        {match.specialty && (
                          <p className="text-xs text-muted-foreground mt-0.5">{match.specialty}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 ml-[52px]">
                      <TrustScore
                        score={match.trustScore || 0}
                        verificationTier={match.verificationTier}
                        resolutionRate={match.resolutionRate}
                        responseTime={match.responseTime}
                        className="flex-row items-center gap-3"
                      />
                    </div>

                    <div className="flex items-center justify-between ml-[52px]">
                      <span className="text-sm font-semibold text-[#102A43]">
                        {match.minPrice !== undefined && match.maxPrice !== undefined
                          ? `${formatNaira(match.minPrice)} - ${formatNaira(match.maxPrice)}`
                          : 'Contact for price'}
                      </span>
                      <Button
                        size="sm"
                        className="bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white rounded-lg"
                        onClick={() => handleRequestQuote(match.name)}
                      >
                        Request Quote
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </section>
          )}

          {/* ===== QUOTES: Show Quote Cards ===== */}
          {(status === 'QUOTE' || status === 'MATCHING') && quotes.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[#102A43]">Quotes ({quotes.length})</h3>
              {quotes.map((quote) => (
                <Card key={quote.id} className="p-4 gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#102A43]">
                        {quote.professional?.name || quote.professional?.businessName || 'Professional'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{quote.scope}</p>
                    </div>
                    <span className="text-lg font-bold text-[#102A43]">
                      {formatNaira(quote.totalAmount)}
                    </span>
                  </div>

                  {quote.timeline && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>Timeline: {quote.timeline}</span>
                    </div>
                  )}

                  {quote.terms && (
                    <p className="text-xs text-muted-foreground">{quote.terms}</p>
                  )}

                  {quote.expiresAt && (
                    <p className={`text-xs ${new Date(quote.expiresAt) < new Date() ? 'text-rezzo-danger font-medium' : 'text-muted-foreground'}`}>
                      {new Date(quote.expiresAt) < new Date()
                        ? 'This quote has expired'
                        : `Valid until ${new Date(quote.expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  )}

                  {quote.status.toUpperCase() !== 'ACCEPTED' && quote.status.toUpperCase() !== 'REJECTED' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white rounded-lg"
                        disabled={actionLoading === quote.id}
                        onClick={() => handleAcceptQuote(quote.id)}
                      >
                        {actionLoading === quote.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-lg border-rezzo-danger/30 text-rezzo-danger hover:bg-rezzo-danger/5"
                        onClick={() => toast.info('Quote declined')}
                      >
                        <X className="size-3.5" />
                        Decline
                      </Button>
                    </div>
                  )}

                  {quote.status.toUpperCase() === 'ACCEPTED' && (
                    <div className="flex items-center gap-1.5 text-xs text-[#1F7A5A] font-medium">
                      <CheckCircle2 className="size-4" />
                      Accepted
                    </div>
                  )}
                </Card>
              ))}
            </section>
          )}

          {/* ===== PAYMENT Section ===== */}
          {(status === 'ACCEPTED' || status === 'PAYMENT') && acceptedQuote && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[#102A43]">Payment</h3>
              <Card className="p-4 gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rezzo-gold/10 flex items-center justify-center">
                    <span className="text-rezzo-gold text-sm">💳</span>
                  </div>
                  <span className="text-sm font-semibold text-[#102A43]">
                    {acceptedQuote.professional?.name || 'Professional'}
                  </span>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Amount</span>
                    <span className="font-medium">{formatNaira(acceptedQuote.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">REZZO Fee (10%)</span>
                    <span className="font-medium">{formatNaira(acceptedQuote.totalAmount * 0.1)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-[#102A43]">Total</span>
                    <span className="font-bold text-[#102A43]">
                      {formatNaira(acceptedQuote.totalAmount * 1.1)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white rounded-xl h-12 text-sm font-semibold"
                  disabled={actionLoading === 'payment'}
                  onClick={() => handlePay(acceptedQuote.id)}
                >
                  {actionLoading === 'payment' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Shield className="size-4" />
                      Pay {formatNaira(acceptedQuote.totalAmount * 1.1)}
                    </>
                  )}
                </Button>

                <p className="text-[10px] text-center text-muted-foreground">
                  Secured by REZZO. Money held in escrow until service is completed.
                </p>
              </Card>
            </section>
          )}

          {/* ===== IN_PROGRESS / FUNDED: Service Tracking ===== */}
          {(status === 'FUNDED' || status === 'IN_PROGRESS') && (
            <>
              {/* Appointment */}
              {caseData.bookings && caseData.bookings.filter((b) => b.status !== 'CANCELLED').length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-[#102A43]">Appointment</h3>
                  {caseData.bookings
                    .filter((b) => b.status !== 'CANCELLED')
                    .map((booking) => (
                      <Card key={booking.id} className="p-4 gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#1F7A5A]/10 flex items-center justify-center">
                            <Calendar className="size-4 text-[#1F7A5A]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#102A43]">
                              {booking.startsAt ? formatDate(booking.startsAt) : 'Time to be confirmed'}
                              {booking.startsAt && ` at ${formatTime(booking.startsAt)}`}
                            </p>
                            {booking.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="size-3" /> {booking.location}
                              </p>
                            )}
                          </div>
                        </div>
                        {booking.confirmedAt ? (
                          <div className="flex items-center gap-1.5 text-xs text-[#1F7A5A] font-medium">
                            <CheckCircle2 className="size-3.5" /> Confirmed
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white"
                              disabled={actionLoading === 'booking-confirm'}
                              onClick={() => handleConfirmBooking(booking.id)}
                            >
                              {actionLoading === 'booking-confirm' ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="size-4" /> Confirm time
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading === 'booking-decline'}
                              onClick={() => handleDeclineBooking(booking.id)}
                            >
                              Not this time
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}
                </section>
              )}

              {/* Timeline */}
              {timeline.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-[#102A43]">Progress</h3>
                  <Card className="p-4 gap-0">
                    <div className="flex flex-col">
                      {timeline.map((event, idx) => (
                        <div key={event.id} className="flex gap-3">
                          {/* Timeline line & dot */}
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm">
                              {getEventIcon(event.type)}
                            </div>
                            {idx < timeline.length - 1 && (
                              <div className="w-0.5 flex-1 bg-border my-1" />
                            )}
                          </div>
                          {/* Content */}
                          <div className="pb-4 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {event.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(event.createdAt)} at {formatTime(event.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              )}

              {/* Messages */}
              {messages.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-[#102A43]">Messages</h3>
                  <Card className="p-4 gap-3">
                    <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                      {messages.map((msg) => {
                        const isMe = msg.senderId === currentUser?.id
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                                isMe
                                  ? 'bg-[#102A43] text-white rounded-br-sm'
                                  : 'bg-muted text-foreground rounded-bl-sm'
                              }`}
                            >
                              <p>{msg.body}</p>
                              <p
                                className={`text-[10px] mt-1 ${
                                  isMe ? 'text-white/60' : 'text-muted-foreground'
                                }`}
                              >
                                {formatTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Message Input */}
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendMessage()
                        }}
                        className="flex-1 rounded-lg"
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        className="rounded-lg bg-[#102A43] hover:bg-[#102A43]/90 shrink-0"
                      >
                        {sendingMessage ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                      </Button>
                    </div>
                  </Card>
                </section>
              )}
            </>
          )}

          {/* ===== PROOF / CUSTOMER_REVIEW: Proof Review ===== */}
          {(status === 'PROOF' || status === 'CUSTOMER_REVIEW') && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-[#102A43]">
                {status === 'PROOF' ? 'Service Proof' : 'Review & Resolve'}
              </h3>

              {proofs.length > 0 && (
                <Card className="p-4 gap-3">
                  {proofs.map((proof) => (
                    <div key={proof.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <span className="text-sm">📸</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{proof.type}</p>
                        <p className="text-xs text-muted-foreground">{proof.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(proof.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              {status === 'PROOF' && (
                <Button
                  className="w-full bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white rounded-xl h-12 text-sm font-semibold"
                  disabled={actionLoading === 'resolve'}
                  onClick={handleResolve}
                >
                  {actionLoading === 'resolve' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Approve & Resolve
                    </>
                  )}
                </Button>
              )}

              {/* Review Form */}
              {status === 'CUSTOMER_REVIEW' && !caseData.review && (
                <Card className="p-4 gap-4">
                  <p className="text-sm font-semibold text-[#102A43]">
                    Rate your experience
                  </p>

                  {/* Star Rating */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1 transition-transform active:scale-90"
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          className={`size-8 ${
                            star <= reviewRating
                              ? 'fill-rezzo-gold text-rezzo-gold'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Comment */}
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)..."
                    className="min-h-[80px] resize-none rounded-lg text-sm"
                  />

                  <Button
                    className="w-full bg-[#102A43] hover:bg-[#102A43]/90 text-white rounded-xl h-11 text-sm font-semibold"
                    disabled={reviewSubmitting || reviewRating === 0}
                    onClick={handleSubmitReview}
                  >
                    {reviewSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      'Submit Review'
                    )}
                  </Button>
                </Card>
              )}

              {caseData.review && (
                <Card className="p-4 gap-2 border-[#1F7A5A]/20 bg-[#1F7A5A]/[0.02]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-[#1F7A5A]" />
                    <span className="text-sm font-semibold text-[#1F7A5A]">
                      Review Submitted
                    </span>
                  </div>
                  <div className="flex gap-0.5 ml-7">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-4 ${
                          star <= caseData.review!.rating
                            ? 'fill-rezzo-gold text-rezzo-gold'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  {caseData.review.comment && (
                    <p className="text-sm text-muted-foreground ml-7">
                      &ldquo;{caseData.review.comment}&rdquo;
                    </p>
                  )}
                </Card>
              )}

              {status === 'CUSTOMER_REVIEW' && !caseData.review && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-12 text-sm font-semibold border-[#1F7A5A]/30 text-[#1F7A5A] hover:bg-[#1F7A5A]/5"
                  disabled={actionLoading === 'resolve'}
                  onClick={handleResolve}
                >
                  {actionLoading === 'resolve' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Skip Review & Approve'
                  )}
                </Button>
              )}
            </section>
          )}

          {/* ===== RESOLVED: Success State ===== */}
          {status === 'RESOLVED' && (
            <section className="flex flex-col gap-4">
              <Card className="p-6 gap-4 border-[#1F7A5A]/20 bg-[#1F7A5A]/[0.02] text-center">
                <div className="w-16 h-16 rounded-full bg-[#1F7A5A]/10 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="size-8 text-[#1F7A5A]" />
                </div>
                <h3 className="text-lg font-bold text-[#1F7A5A]">Resolution Complete</h3>
                <p className="text-sm text-muted-foreground">
                  Your case has been successfully resolved. Thank you for using REZZO!
                </p>
              </Card>

              {/* Show review if exists */}
              {caseData.review && (
                <Card className="p-4 gap-2">
                  <p className="text-xs text-muted-foreground">Your Review</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-4 ${
                          star <= caseData.review!.rating
                            ? 'fill-rezzo-gold text-rezzo-gold'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  {caseData.review.comment && (
                    <p className="text-sm text-muted-foreground">
                      &ldquo;{caseData.review.comment}&rdquo;
                    </p>
                  )}
                </Card>
              )}

              {/* Review form if not submitted */}
              {!caseData.review && caseData.professional && (
                <Card className="p-4 gap-4">
                  <p className="text-sm font-semibold text-[#102A43]">
                    How was your experience with {caseData.professional.name}?
                  </p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1 transition-transform active:scale-90"
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          className={`size-8 ${
                            star <= reviewRating
                              ? 'fill-rezzo-gold text-rezzo-gold'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience (optional)..."
                    className="min-h-[80px] resize-none rounded-lg text-sm"
                  />
                  <Button
                    className="w-full bg-[#102A43] hover:bg-[#102A43]/90 text-white rounded-xl h-11 text-sm font-semibold"
                    disabled={reviewSubmitting || reviewRating === 0}
                    onClick={handleSubmitReview}
                  >
                    {reviewSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      'Submit Review'
                    )}
                  </Button>
                </Card>
              )}
            </section>
          )}

          {/* ===== DISPUTED ===== */}
          {status === 'DISPUTED' && (
            <section className="flex flex-col gap-4">
              <Card className="p-6 gap-4 border-rezzo-danger/20 bg-rezzo-danger/[0.02] text-center">
                <div className="w-16 h-16 rounded-full bg-rezzo-danger/10 mx-auto flex items-center justify-center">
                  <AlertCircle className="size-8 text-rezzo-danger" />
                </div>
                <h3 className="text-lg font-bold text-rezzo-danger">Dispute Opened</h3>
                <p className="text-sm text-muted-foreground">
                  A dispute has been opened on this case. The REZZO team is reviewing the situation and will contact you shortly.
                </p>
              </Card>

              {/* Timeline */}
              {timeline.length > 0 && (
                <Card className="p-4 gap-3">
                  <h3 className="text-sm font-semibold text-[#102A43]">Case History</h3>
                  <div className="flex flex-col">
                    {timeline.map((event, idx) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs">
                            {getEventIcon(event.type)}
                          </div>
                          {idx < timeline.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border my-1" />
                          )}
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-sm text-foreground">{event.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(event.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </section>
          )}

          {/* ===== UNDERSTANDING / CLARIFICATION / ROUTED: AI Processing ===== */}
          {(status === 'NEW' || status === 'UNDERSTANDING' || status === 'CLARIFICATION' || status === 'ROUTED') && (
            <section className="flex flex-col gap-4">
              <Card className="p-6 gap-4 text-center">
                <Loader2 className="size-8 animate-spin text-[#1F7A5A] mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-[#102A43]">
                    {status === 'NEW' && 'Case Created'}
                    {status === 'UNDERSTANDING' && 'REZZO is Analyzing Your Need'}
                    {status === 'CLARIFICATION' && 'We Need More Information'}
                    {status === 'ROUTED' && 'Routing to Professionals'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {status === 'CLARIFICATION'
                      ? 'Our AI is determining the best way to help you. This usually takes less than a minute.'
                      : 'Please wait while REZZO processes your request...'}
                  </p>
                </div>
              </Card>

              {/* Timeline if available */}
              {timeline.length > 0 && (
                <Card className="p-4 gap-3">
                  <h3 className="text-sm font-semibold text-[#102A43]">Activity</h3>
                  <div className="flex flex-col">
                    {timeline.map((event, idx) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs">
                            {getEventIcon(event.type)}
                          </div>
                          {idx < timeline.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border my-1" />
                          )}
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-sm text-foreground">{event.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(event.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </section>
          )}

        </div>
      </ScrollArea>
    </div>
  )
}
