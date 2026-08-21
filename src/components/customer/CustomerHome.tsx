'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRezzoStore, apiPost, apiGet } from '@/store/rezzo-store'
import { CaseCard } from '@/components/rezzo/CaseCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Mic, Camera, Upload, Keyboard, Send, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface CaseItem {
  id: string
  caseNumber: string
  status: string
  protectionStatus?: string
  need?: { title?: string; description?: string }
  createdAt: string
}

interface FollowUpItem {
  id: string
  triggerType: string
  dueAt?: string | null
  case?: { caseNumber?: string; need?: { title?: string } }
}

// PRD Upgrade §11 "Case Continuity" — friendly copy per trigger type.
const FOLLOWUP_COPY: Record<string, { label: string; prompt: string }> = {
  MAINTENANCE_REMINDER: { label: 'Due for a maintenance check?', prompt: 'I need a maintenance check on ' },
  WARRANTY_CHECK: { label: 'Worth checking your warranty coverage', prompt: 'I want to check warranty coverage for ' },
  DOCUMENTATION_ROUTE: { label: 'Related documentation may be due', prompt: 'I need help with documentation related to ' },
  TAX_COMPLIANCE_ROUTE: { label: 'Tax/compliance may need attention', prompt: 'I need help with tax/compliance for ' },
  REPEAT_SERVICE: { label: 'Need this done again?', prompt: 'I need this done again: ' },
  OTHER: { label: 'REZZO has a suggestion for you', prompt: 'Following up on ' },
}

function dueLabel(dueAt?: string | null) {
  if (!dueAt) return null
  const diffDays = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000)
  if (diffDays < 0) return 'Was due a while ago'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays < 30) return `Due in ${diffDays} days`
  return `Due ${new Date(dueAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}`
}

const ACTION_BUTTONS = [
  { icon: Mic, label: 'Tell', desc: 'Speak your need', color: 'bg-[#102A43] text-white' },
  { icon: Camera, label: 'Show', desc: 'Take a photo', color: 'bg-[#1F7A5A] text-white' },
  { icon: Upload, label: 'Upload', desc: 'Share a file', color: 'bg-[#E0A23A] text-white' },
  { icon: Keyboard, label: 'Type', desc: 'Describe in text', color: 'bg-[#52606D] text-white' },
] as const

// One example per launch vertical (design spec §7: "Suggested prompts for
// first-time users"). Chosen to match the keyword routes the AI orchestrator
// already recognizes, so tapping one produces a real, sensible result.
const SUGGESTED_PROMPTS = [
  'My AC is not cooling properly',
  'I need help registering my business',
  'I want to verify a property before buying it',
  'I need help renewing my passport',
] as const

export function CustomerHome() {
  const setSelectedCaseId = useRezzoStore((s) => s.setSelectedCaseId)
  const setCustomerTab = useRezzoStore((s) => s.setCustomerTab)

  const [text, setText] = useState('')
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([])

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ cases: CaseItem[] }>('/cases')
      setCases(data.cases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFollowUps = useCallback(async () => {
    try {
      const data = await apiGet<{ followUps: FollowUpItem[] }>('/follow-ups')
      setFollowUps(data.followUps || [])
    } catch {
      // Follow-ups are a nice-to-have; fail silently rather than block the home screen
    }
  }, [])

  useEffect(() => {
    fetchCases()
    fetchFollowUps()
  }, [fetchCases, fetchFollowUps])

  const handleFollowUpDismiss = async (id: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id))
    apiPost(`/follow-ups/${id}`, { status: 'DISMISSED' }).catch(() => {})
  }

  const handleFollowUpAct = async (f: FollowUpItem) => {
    const copy = FOLLOWUP_COPY[f.triggerType] || FOLLOWUP_COPY.OTHER
    const subject = f.case?.need?.title || f.case?.caseNumber || 'my earlier case'
    setText(`${copy.prompt}${subject}`)
    setFollowUps((prev) => prev.filter((x) => x.id !== f.id))
    apiPost(`/follow-ups/${f.id}`, { status: 'COMPLETED' }).catch(() => {})
    focusTextInput()
  }

  const activeCases = cases.filter((c) => {
    const s = c.status.toUpperCase()
    return !['RESOLVED', 'COMPLETED', 'CANCELLED', 'DISPUTED'].includes(s)
  })

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const result = await apiPost<{ case: { id: string; caseNumber: string; status: string } }>('/cases', {
        input: { text: trimmed },
        channel: 'app',
      })
      const newCase = result.case
      setText('')
      toast.success(`Case ${newCase.caseNumber} created`, { description: 'REZZO is analyzing your need' })
      // Wait for AI orchestration then open case
      setTimeout(() => {
        fetchCases()
        setSelectedCaseId(newCase.id)
      }, 2500)
    } catch (err) {
      toast.error('Failed to create case', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const focusTextInput = () => {
    const el = document.getElementById('rezzo-text-input')
    el?.focus()
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-6">
      {/* Hero */}
      <section>
        <h1 className="text-[28px] font-bold text-[#102A43] leading-tight">
          What do you need done?
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell REZZO and we&apos;ll find the right professional
        </p>
      </section>

      {/* Action Buttons */}
      <section className="grid grid-cols-4 gap-3">
        {ACTION_BUTTONS.map((btn) => {
          const Icon = btn.icon
          return (
            <button
              key={btn.label}
              onClick={btn.label === 'Type' ? focusTextInput : () => {
                if (btn.label !== 'Type') {
                  toast.info(`${btn.label} coming soon!`, { description: 'Try typing your need below' })
                }
              }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-transform active:scale-95 ${btn.color}`}
              aria-label={btn.label}
            >
              <Icon className="size-6" />
              <span className="text-xs font-medium">{btn.label}</span>
            </button>
          )
        })}
      </section>

      {/* Text Input */}
      <section>
        <div className="relative">
          <Textarea
            id="rezzo-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'Describe what you need... e.g. “My AC is not cooling properly”'}
            className="min-h-[80px] resize-none pr-12 rounded-xl text-sm"
            disabled={submitting}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="absolute right-2 bottom-2 rounded-lg bg-[#102A43] hover:bg-[#102A43]/90 h-9 w-9"
            aria-label="Submit"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        {submitting && (
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>REZZO is analyzing your need...</span>
          </div>
        )}
        {!text.trim() && !submitting && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setText(prompt); focusTextInput() }}
                className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-white text-muted-foreground hover:border-[#1F7A5A]/40 hover:text-[#1F7A5A] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Active Cases */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#102A43]">
            Active Cases ({activeCases.length})
          </h2>
          {cases.length > 0 && (
            <button
              onClick={() => setCustomerTab('cases')}
              className="text-xs text-[#1F7A5A] font-medium hover:underline"
            >
              View all
            </button>
          )}
        </div>

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-6">
            <p className="text-sm text-rezzo-danger mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCases}>
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && activeCases.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
              <Shield className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No active cases. Tell REZZO what you need.
            </p>
          </div>
        )}

        {!loading && !error && activeCases.length > 0 && (
          <div className="flex flex-col gap-3">
            {activeCases.map((c) => (
              <CaseCard
                key={c.id}
                caseNumber={c.caseNumber}
                status={c.status}
                protectionStatus={c.protectionStatus}
                title={c.need?.title || c.need?.description || 'Untitled case'}
                date={new Date(c.createdAt).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                })}
                onClick={() => setSelectedCaseId(c.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Follow-up reminders (PRD Upgrade §11 Case Continuity) */}
      {followUps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#102A43] mb-3">
            Recommended for you
          </h2>
          <div className="flex flex-col gap-2">
            {followUps.map((f) => {
              const copy = FOLLOWUP_COPY[f.triggerType] || FOLLOWUP_COPY.OTHER
              const due = dueLabel(f.dueAt)
              return (
                <div
                  key={f.id}
                  className="p-3 rounded-xl border border-[#E0A23A]/30 bg-[#E0A23A]/5 flex flex-col gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[#102A43]">{copy.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.case?.need?.title || f.case?.caseNumber}
                      {due && ` · ${due}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs rounded-lg border-[#E0A23A]/40 text-[#B7791F] hover:bg-[#E0A23A]/10"
                      onClick={() => handleFollowUpAct(f)}
                    >
                      Tell REZZO
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => handleFollowUpDismiss(f.id)}
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
