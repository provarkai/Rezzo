'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/rezzo/StatusBadge'
import { NairaInput, formatNaira } from '@/components/rezzo/NairaInput'
import { useRezzoStore, apiGet, apiPost } from '@/store/rezzo-store'
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  FileText,
  Upload,
  Calendar,
} from 'lucide-react'

interface CaseMessage {
  id: string
  senderId: string
  senderName?: string
  body: string
  createdAt: string
  senderRole?: string
}

interface TimelineEvent {
  id: string
  type: string
  description: string
  createdAt: string
}

interface CaseDetail {
  id: string
  caseNumber: string
  status: string
  title?: string
  createdAt: string
  matter?: {
    title?: string
    summary?: string
    category?: string
    complexity?: string
  }
  customer?: { name?: string }
  quotes?: Array<{
    id: string
    scope?: string
    totalAmount?: number
    timeline?: string
    terms?: string
    status?: string
    expiresAt?: string
  }>
  bookings?: Array<{
    id: string
    startsAt?: string
    endsAt?: string
    location?: string
    notes?: string
    status: string
    confirmedAt?: string
    quoteId?: string
  }>
}

export function ProfessionalCaseDetail() {
  const caseId = useRezzoStore((s) => s.proSelectedCaseId)
  const setProSelectedCaseId = useRezzoStore((s) => s.setProSelectedCaseId)
  const currentUser = useRezzoStore((s) => s.currentUser)

  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Quote form state
  const [quoteScope, setQuoteScope] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteTimeline, setQuoteTimeline] = useState('')
  const [quoteTerms, setQuoteTerms] = useState('')
  const [quoteValidDays, setQuoteValidDays] = useState('7')
  const [submittingQuote, setSubmittingQuote] = useState(false)

  // Booking form state
  const [bookingStartsAt, setBookingStartsAt] = useState('')
  const [bookingLocation, setBookingLocation] = useState('')
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [cancellingBooking, setCancellingBooking] = useState(false)

  // Proof form state
  const [proofDescription, setProofDescription] = useState('')
  const [proofType, setProofType] = useState('COMPLETION')
  const [submittingProof, setSubmittingProof] = useState(false)

  // Message state
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    if (!caseId) return
    try {
      setLoading(true)
      setError(null)
      const [caseRes, msgRes, tlRes] = await Promise.all([
        apiGet<{ case: Record<string, unknown>; matter?: Record<string, unknown>; quotes?: Record<string, unknown>[]; bookings?: Record<string, unknown>[] }>(`/cases/${caseId}`),
        apiGet<{ messages?: Record<string, unknown>[] }>(`/cases/${caseId}/messages`).catch(() => ({ messages: [] })),
        apiGet<{ timeline?: Record<string, unknown>[] }>(`/cases/${caseId}/timeline`).catch(() => ({ timeline: [] })),
      ])
      // The API nests case fields under `case` and lists (quotes, bookings, ...)
      // at the top level — flatten into the shape this component expects,
      // same pattern as the customer CaseWorkspace.
      const c = caseRes.case as unknown as CaseDetail
      c.matter = caseRes.matter as CaseDetail['matter']
      c.quotes = caseRes.quotes as CaseDetail['quotes']
      c.bookings = caseRes.bookings as CaseDetail['bookings']
      setCaseData(c)
      const msgList = (msgRes.messages || []).map((m: Record<string, unknown>) => ({
        id: String(m.id),
        senderId: String(m.senderId || ''),
        senderName: String((m.sender as Record<string, unknown>)?.profile?.displayName || (m.sender as Record<string, unknown>)?.profile?.name || ''),
        senderRole: String((m.sender as Record<string, unknown>)?.role || ''),
        body: String(m.body || ''),
        createdAt: String(m.createdAt || ''),
      })) as unknown as CaseMessage[]
      setMessages(msgList)
      const tlList = (tlRes.timeline || []).map((e: Record<string, unknown>) => ({
        id: String(e.id),
        type: String(e.eventType || e.type || ''),
        description: String(e.eventType || e.description || ''),
        createdAt: String(e.createdAt || ''),
      })) as unknown as TimelineEvent[]
      setTimeline(tlList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendQuote = async () => {
    if (!caseId || !quoteScope.trim()) return
    try {
      setSubmittingQuote(true)
      const rawAmount = quoteAmount.replace(/[^0-9]/g, '')
      const expiresAt = quoteValidDays
        ? new Date(Date.now() + parseInt(quoteValidDays, 10) * 24 * 60 * 60 * 1000).toISOString()
        : undefined
      await apiPost(`/cases/${caseId}/quotes`, {
        scope: quoteScope,
        totalAmount: rawAmount ? parseInt(rawAmount, 10) : 0,
        timeline: quoteTimeline || undefined,
        terms: quoteTerms || undefined,
        expiresAt,
      })
      setQuoteScope('')
      setQuoteAmount('')
      setQuoteTimeline('')
      setQuoteTerms('')
      setQuoteValidDays('7')
      await fetchData()
    } catch (err) {
      // Quote failed silently for now
    } finally {
      setSubmittingQuote(false)
    }
  }

  const handleProposeBooking = async (quoteId: string) => {
    if (!bookingStartsAt) return
    try {
      setSubmittingBooking(true)
      await apiPost(`/quotes/${quoteId}/booking`, {
        startsAt: new Date(bookingStartsAt).toISOString(),
        location: bookingLocation || undefined,
      })
      setBookingStartsAt('')
      setBookingLocation('')
      await fetchData()
    } catch (err) {
      // Booking proposal failed silently, same as the quote/proof handlers above
    } finally {
      setSubmittingBooking(false)
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setCancellingBooking(true)
      await apiPost(`/bookings/${bookingId}/cancel`)
      await fetchData()
    } catch (err) {
      // Cancel failed silently
    } finally {
      setCancellingBooking(false)
    }
  }

  const handleSubmitProof = async () => {
    if (!caseId || !proofDescription.trim()) return
    try {
      setSubmittingProof(true)
      await apiPost(`/cases/${caseId}/proof`, {
        type: proofType,
        description: proofDescription,
      })
      setProofDescription('')
      await fetchData()
    } catch (err) {
      // Proof failed silently
    } finally {
      setSubmittingProof(false)
    }
  }

  const handleSendMessage = async () => {
    if (!caseId || !messageInput.trim()) return
    try {
      setSendingMessage(true)
      await apiPost(`/cases/${caseId}/messages`, { body: messageInput.trim() })
      setMessageInput('')
      await fetchData()
    } catch (err) {
      // Send failed
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !caseData) {
    return (
      <div className="p-4 md:p-6">
        <Button variant="ghost" size="sm" onClick={() => setProSelectedCaseId(null)} className="mb-4">
          <ArrowLeft className="size-4 mr-2" /> Back
        </Button>
        <Card className="p-6 text-center">
          <p className="text-sm text-rezzo-danger mb-3">{error || 'Case not found'}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
        </Card>
      </div>
    )
  }

  const status = caseData.status.toUpperCase()
  const showQuoteBuilder = ['MATCHING', 'QUOTE'].includes(status)
  const showProofSection = ['IN_PROGRESS', 'PROOF'].includes(status)
  const caseTitle = caseData.title || caseData.matter?.title || 'Untitled Case'
  const acceptedQuote = caseData.quotes?.find((q) => q.status === 'ACCEPTED')
  const showBookingSection = ['FUNDED', 'IN_PROGRESS'].includes(status) && !!acceptedQuote
  const activeBooking = acceptedQuote
    ? caseData.bookings?.find((b) => b.quoteId === acceptedQuote.id && b.status !== 'CANCELLED')
    : undefined

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setProSelectedCaseId(null)}
          aria-label="Back to cases"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-[#102A43]">{caseData.caseNumber}</h1>
            <StatusBadge status={caseData.status} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{caseTitle}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* AI Case Brief */}
          {caseData.matter && (
            <Card className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-rezzo-gold" />
                <h2 className="text-sm font-semibold text-[#102A43]">AI Case Brief</h2>
              </div>
              {caseData.matter.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {caseData.matter.summary}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {caseData.matter.category && (
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {caseData.matter.category}
                  </span>
                )}
                {caseData.matter.complexity && (
                  <span className="text-xs px-2 py-1 rounded-full bg-rezzo-green/10 text-rezzo-green">
                    {caseData.matter.complexity}
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Customer Need / Matter */}
          <Card className="p-4 md:p-6">
            <h2 className="text-sm font-semibold text-[#102A43] mb-3">Customer Need</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{caseTitle}</p>
            {caseData.customer?.name && (
              <p className="text-xs text-muted-foreground mt-2">
                Customer: <span className="font-medium text-foreground">{caseData.customer.name}</span>
              </p>
            )}
          </Card>

          {/* Quote Builder */}
          {showQuoteBuilder && (
            <Card className="p-4 md:p-6 border-rezzo-gold/30 bg-rezzo-gold/5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="size-4 text-rezzo-gold" />
                <h2 className="text-sm font-semibold text-[#102A43]">Send a Quote</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Scope of Work
                  </label>
                  <Textarea
                    value={quoteScope}
                    onChange={(e) => setQuoteScope(e.target.value)}
                    placeholder="Describe the work you will perform..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Total Amount
                  </label>
                  <NairaInput
                    value={quoteAmount}
                    onChange={setQuoteAmount}
                    placeholder="0"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Timeline
                  </label>
                  <Input
                    value={quoteTimeline}
                    onChange={(e) => setQuoteTimeline(e.target.value)}
                    placeholder="e.g. 3-5 business days"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Quote Valid For
                  </label>
                  <select
                    value={quoteValidDays}
                    onChange={(e) => setQuoteValidDays(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="">No expiry</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Terms & Conditions
                  </label>
                  <Textarea
                    value={quoteTerms}
                    onChange={(e) => setQuoteTerms(e.target.value)}
                    placeholder="Any terms for the customer..."
                    rows={2}
                  />
                </div>
                <Button
                  className="w-full bg-rezzo-green hover:bg-rezzo-green/90 text-white"
                  disabled={submittingQuote || !quoteScope.trim()}
                  onClick={handleSendQuote}
                >
                  {submittingQuote ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Send className="size-4 mr-2" />
                  )}
                  Send Quote
                </Button>
              </div>
            </Card>
          )}

          {/* Appointment / Booking */}
          {showBookingSection && acceptedQuote && (
            <Card className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="size-4 text-[#1F7A5A]" />
                <h2 className="text-sm font-semibold text-[#102A43]">Appointment</h2>
              </div>
              {activeBooking ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30">
                    <p className="text-sm font-medium text-foreground">
                      {activeBooking.startsAt
                        ? new Date(activeBooking.startsAt).toLocaleString('en-NG', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })
                        : 'Time to be confirmed'}
                    </p>
                    {activeBooking.location && (
                      <p className="text-xs text-muted-foreground mt-1">{activeBooking.location}</p>
                    )}
                    <p className="text-xs mt-1 font-medium" style={{ color: activeBooking.confirmedAt ? '#1F7A5A' : '#8A5A0F' }}>
                      {activeBooking.confirmedAt ? 'Confirmed by customer' : 'Awaiting customer confirmation'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={cancellingBooking}
                    onClick={() => handleCancelBooking(activeBooking.id)}
                  >
                    {cancellingBooking ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    {activeBooking.confirmedAt ? 'Cancel appointment' : 'Withdraw proposed time'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Proposed Date &amp; Time
                    </label>
                    <Input
                      type="datetime-local"
                      value={bookingStartsAt}
                      onChange={(e) => setBookingStartsAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Location (optional)
                    </label>
                    <Input
                      value={bookingLocation}
                      onChange={(e) => setBookingLocation(e.target.value)}
                      placeholder="e.g. Customer's address"
                    />
                  </div>
                  <Button
                    className="w-full bg-[#1F7A5A] hover:bg-[#1F7A5A]/90 text-white"
                    disabled={submittingBooking || !bookingStartsAt}
                    onClick={() => handleProposeBooking(acceptedQuote.id)}
                  >
                    {submittingBooking ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Calendar className="size-4 mr-2" />
                    )}
                    Propose Appointment
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Proof Upload Section */}
          {showProofSection && (
            <Card className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="size-4 text-rezzo-green" />
                <h2 className="text-sm font-semibold text-[#102A43]">Submit Proof of Work</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Proof Type
                  </label>
                  <select
                    value={proofType}
                    onChange={(e) => setProofType(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="COMPLETION">Completion Proof</option>
                    <option value="PROGRESS">Progress Update</option>
                    <option value="DELIVERABLE">Deliverable</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Description
                  </label>
                  <Textarea
                    value={proofDescription}
                    onChange={(e) => setProofDescription(e.target.value)}
                    placeholder="Describe the work completed..."
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full bg-[#102A43] hover:bg-[#102A43]/90 text-white"
                  disabled={submittingProof || !proofDescription.trim()}
                  onClick={handleSubmitProof}
                >
                  {submittingProof ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="size-4 mr-2" />
                  )}
                  Submit Proof
                </Button>
              </div>
            </Card>
          )}

          {/* Messages Section */}
          <Card className="flex flex-col h-[400px]">
            <div className="p-4 border-b border-border/60">
              <h2 className="text-sm font-semibold text-[#102A43]">Messages</h2>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No messages yet. Start the conversation.
                  </p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.senderId === currentUser?.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'bg-[#102A43] text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                      >
                        {!isMine && msg.senderName && (
                          <p className={`text-xs mb-1 ${isMine ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {msg.senderName}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">{msg.body}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMine ? 'text-white/50' : 'text-muted-foreground'
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString('en-NG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border/60">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button
                  size="icon"
                  disabled={sendingMessage || !messageInput.trim()}
                  onClick={handleSendMessage}
                  className="bg-[#102A43] hover:bg-[#102A43]/90 text-white shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Timeline */}
        <div>
          <Card className="p-4 md:p-6 sticky top-20">
            <h2 className="text-sm font-semibold text-[#102A43] mb-4">Timeline</h2>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No timeline events yet
              </p>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-4">
                  {timeline.map((event, idx) => {
                    const isLast = idx === timeline.length - 1
                    return (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-rezzo-green shrink-0 mt-1" />
                          {!isLast && (
                            <div className="w-px flex-1 bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-xs font-medium text-[#102A43]">
                            {event.description || event.type}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(event.createdAt).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Existing Quotes */}
            {caseData.quotes && caseData.quotes.length > 0 && (
              <>
                <Separator className="my-4" />
                <h3 className="text-xs font-semibold text-[#102A43] mb-3">Quotes Sent</h3>
                <div className="space-y-2">
                  {caseData.quotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-lg border border-border/60 bg-muted/30"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-rezzo-green">
                          {formatNaira(q.totalAmount ?? 0)}
                        </span>
                        {q.status && (
                          <StatusBadge status={q.status} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {q.scope || 'No scope details'}
                      </p>
                      {q.timeline && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{q.timeline}</span>
                        </div>
                      )}
                      {q.expiresAt && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(q.expiresAt) < new Date()
                            ? 'Expired'
                            : `Expires ${new Date(q.expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
