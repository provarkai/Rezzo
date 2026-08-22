'use client'

import { useState } from 'react'
import { useRezzoStore, apiPost } from '@/store/rezzo-store'
import { SERVICE_CATEGORIES } from '@/lib/domain/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Wrench, LogOut, Upload, FileCheck2, X } from 'lucide-react'
import { toast } from 'sonner'

// Mirrors src/app/api/v1/professionals/apply/route.ts's applySchema — kept
// in sync by hand since the client has no access to the server-side Zod
// schema. A new Professional record starts at verificationStatus PENDING;
// it only becomes active (matchable, allowed to submit quotes — see
// isVerificationActive in constants.ts) once an admin reviews it. That
// review is itself staged: ProfessionalVerificationStatus shows where an
// application currently sits.
const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const
const PRICING_TYPES = ['QUOTE_REQUIRED', 'FIXED', 'STARTING_FROM', 'HOURLY', 'MILESTONE'] as const
const CREDENTIAL_TYPES = ['IDENTITY', 'LICENSE', 'CERTIFICATE', 'DEGREE'] as const

// Matches MAX_DOCUMENT_BYTES in document-service.ts — can't import it
// directly, that module pulls in @/lib/db (server-only). Kept in sync by
// hand; rejecting oversized files client-side just avoids a round trip,
// the server enforces the real limit regardless.
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

interface SkillRow { name: string; level: typeof SKILL_LEVELS[number]; categoryId: string }
interface ServiceRow { name: string; description: string; pricingType: typeof PRICING_TYPES[number]; amount: string; unit: string; categoryId: string }
interface CredentialDocument { fileName: string; mimeType: string; dataBase64: string }
interface CredentialRow { type: typeof CREDENTIAL_TYPES[number]; issuer: string; reference: string; document?: CredentialDocument }

const selectClass = 'h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-all'

// FileReader.readAsDataURL() yields "data:<mime>;base64,<payload>" —
// uploadDocument() (document-service.ts) wants just <payload>.
function readFileAsBase64(file: File): Promise<{ mimeType: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const commaIndex = result.indexOf(',')
      resolve({ mimeType: file.type || 'application/octet-stream', dataBase64: result.slice(commaIndex + 1) })
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function ProfessionalApply() {
  const currentUser = useRezzoStore((s) => s.currentUser)
  const professionalApplyOpen = useRezzoStore((s) => s.professionalApplyOpen)
  const setProfessionalApplyOpen = useRezzoStore((s) => s.setProfessionalApplyOpen)
  const updateCurrentUser = useRezzoStore((s) => s.updateCurrentUser)
  const logout = useRezzoStore((s) => s.logout)
  const setCurrentView = useRezzoStore((s) => s.setCurrentView)

  const [bio, setBio] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [skills, setSkills] = useState<SkillRow[]>([{ name: '', level: 'INTERMEDIATE', categoryId: '' }])
  const [services, setServices] = useState<ServiceRow[]>([{ name: '', description: '', pricingType: 'QUOTE_REQUIRED', amount: '', unit: '', categoryId: '' }])
  const [credentials, setCredentials] = useState<CredentialRow[]>([{ type: 'IDENTITY', issuer: '', reference: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // This form is reachable two ways: an existing customer explicitly opened
  // it (professionalApplyOpen), or someone registered choosing "Professional"
  // and has no Professional record yet — see page.tsx. Only the first case
  // has anywhere sensible to cancel back to.
  const canCancel = professionalApplyOpen
  const handleCancel = () => setProfessionalApplyOpen(false)
  const handleLogout = () => {
    logout()
    setCurrentView('landing')
  }

  const updateSkill = (i: number, patch: Partial<SkillRow>) =>
    setSkills((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const updateService = (i: number, patch: Partial<ServiceRow>) =>
    setServices((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const updateCredential = (i: number, patch: Partial<CredentialRow>) =>
    setCredentials((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const handleCredentialFile = async (i: number, file: File | null) => {
    if (!file) {
      updateCredential(i, { document: undefined })
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error(`${file.name} is too large — max ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB`)
      return
    }
    try {
      const { mimeType, dataBase64 } = await readFileAsBase64(file)
      updateCredential(i, { document: { fileName: file.name, mimeType, dataBase64 } })
    } catch {
      toast.error(`Could not read ${file.name}`)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!serviceArea.trim()) {
      setError('Service area is required')
      return
    }
    const validSkills = skills.filter((s) => s.name.trim())
    if (validSkills.length === 0) {
      setError('Add at least one skill')
      return
    }
    const validServices = services.filter((s) => s.name.trim())
    if (validServices.length === 0) {
      setError('Add at least one service you offer')
      return
    }
    const validCredentials = credentials.filter((c) => c.type)
    if (validCredentials.length === 0) {
      setError('Add at least one credential to verify')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPost<{ professional: { id: string; verificationStatus: string } }>(
        '/professionals/apply',
        {
          bio: bio.trim() || undefined,
          serviceArea: serviceArea.trim(),
          skills: validSkills.map((s) => ({ name: s.name.trim(), level: s.level, categoryId: s.categoryId || undefined })),
          services: validServices.map((s) => ({
            name: s.name.trim(),
            description: s.description.trim() || undefined,
            pricingType: s.pricingType,
            categoryId: s.categoryId || undefined,
            prices: s.amount.trim() ? [{ amount: Number(s.amount), unit: s.unit.trim() || undefined }] : undefined,
          })),
          credentials: validCredentials.map((c) => ({
            type: c.type,
            issuer: c.issuer.trim() || undefined,
            reference: c.reference.trim() || undefined,
            document: c.document,
          })),
        }
      )
      updateCurrentUser({ professionalId: res.professional.id, verificationStatus: res.professional.verificationStatus })
      setProfessionalApplyOpen(false)
      toast.success("Application submitted — we'll review your credentials before you can accept cases.")
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB] px-4 py-10">
      <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-rezzo-gold/10 flex items-center justify-center mx-auto mb-3">
            <Wrench className="size-5 text-rezzo-gold" />
          </div>
          <h1 className="text-xl font-bold text-rezzo-navy">Apply as a Professional{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
            Tell us what you do and share your credentials. Every application is reviewed in
            stages before you can accept cases — you&apos;ll see exactly where yours stands.
          </p>
        </div>

        <Card className="p-5 rounded-2xl flex flex-col gap-4">
          <div>
            <Label htmlFor="apply-service-area">Service area *</Label>
            <Input
              id="apply-service-area"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              placeholder="e.g. Lagos, Ikeja"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="apply-bio">Bio</Label>
            <Textarea
              id="apply-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short summary of your experience"
              className="mt-1.5"
              rows={3}
            />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-rezzo-navy">Skills *</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-rezzo-green hover:text-rezzo-green"
              onClick={() => setSkills((rows) => [...rows, { name: '', level: 'INTERMEDIATE', categoryId: '' }])}
            >
              <Plus className="size-3.5" /> Add skill
            </Button>
          </div>
          {skills.map((skill, i) => (
            <div key={i} className="flex flex-col gap-2 pb-3 border-b border-border/60 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Input
                  value={skill.name}
                  onChange={(e) => updateSkill(i, { name: e.target.value })}
                  placeholder="e.g. AC Repair"
                  aria-label={`Skill ${i + 1} name`}
                  className="flex-1"
                />
                {skills.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSkills((rows) => rows.filter((_, idx) => idx !== i))}
                    aria-label={`Remove skill ${i + 1}`}
                    className="p-2 text-muted-foreground hover:text-rezzo-danger transition-colors shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={skill.level}
                  onChange={(e) => updateSkill(i, { level: e.target.value as SkillRow['level'] })}
                  aria-label={`Skill ${i + 1} level`}
                  className={`${selectClass} w-36 shrink-0`}
                >
                  {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>)}
                </select>
                <select
                  value={skill.categoryId}
                  onChange={(e) => updateSkill(i, { categoryId: e.target.value })}
                  aria-label={`Skill ${i + 1} category`}
                  className={`${selectClass} flex-1`}
                >
                  <option value="">No category</option>
                  {SERVICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </Card>

        <Card className="p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-rezzo-navy">Services you offer *</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-rezzo-green hover:text-rezzo-green"
              onClick={() => setServices((rows) => [...rows, { name: '', description: '', pricingType: 'QUOTE_REQUIRED', amount: '', unit: '', categoryId: '' }])}
            >
              <Plus className="size-3.5" /> Add service
            </Button>
          </div>
          {services.map((service, i) => (
            <div key={i} className="flex flex-col gap-2 pb-4 border-b border-border/60 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Input
                  value={service.name}
                  onChange={(e) => updateService(i, { name: e.target.value })}
                  placeholder="e.g. Split AC installation"
                  aria-label={`Service ${i + 1} name`}
                  className="flex-1"
                />
                {services.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setServices((rows) => rows.filter((_, idx) => idx !== i))}
                    aria-label={`Remove service ${i + 1}`}
                    className="p-2 text-muted-foreground hover:text-rezzo-danger transition-colors shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <Textarea
                value={service.description}
                onChange={(e) => updateService(i, { description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                aria-label={`Service ${i + 1} description`}
              />
              <div className="flex items-center gap-2">
                <select
                  value={service.pricingType}
                  onChange={(e) => updateService(i, { pricingType: e.target.value as ServiceRow['pricingType'] })}
                  aria-label={`Service ${i + 1} pricing type`}
                  className={`${selectClass} w-44 shrink-0`}
                >
                  {PRICING_TYPES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                </select>
                <select
                  value={service.categoryId}
                  onChange={(e) => updateService(i, { categoryId: e.target.value })}
                  aria-label={`Service ${i + 1} category`}
                  className={`${selectClass} flex-1`}
                >
                  <option value="">No category</option>
                  {SERVICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={service.amount}
                  onChange={(e) => updateService(i, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="Amount (₦, optional)"
                  inputMode="decimal"
                  aria-label={`Service ${i + 1} price amount`}
                  className="flex-1"
                />
                <Input
                  value={service.unit}
                  onChange={(e) => updateService(i, { unit: e.target.value })}
                  placeholder="Unit (optional)"
                  aria-label={`Service ${i + 1} price unit`}
                  className="w-28 shrink-0"
                />
              </div>
            </div>
          ))}
        </Card>

        <Card className="p-5 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-rezzo-navy">Credentials *</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Each one is verified individually before your application is approved.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-rezzo-green hover:text-rezzo-green shrink-0"
              onClick={() => setCredentials((rows) => [...rows, { type: 'IDENTITY', issuer: '', reference: '' }])}
            >
              <Plus className="size-3.5" /> Add credential
            </Button>
          </div>
          {credentials.map((cred, i) => (
            <div key={i} className="flex flex-col gap-2 pb-3 border-b border-border/60 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <select
                  value={cred.type}
                  onChange={(e) => updateCredential(i, { type: e.target.value as CredentialRow['type'] })}
                  aria-label={`Credential ${i + 1} type`}
                  className={`${selectClass} w-36 shrink-0`}
                >
                  {CREDENTIAL_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
                <Input
                  value={cred.issuer}
                  onChange={(e) => updateCredential(i, { issuer: e.target.value })}
                  placeholder="Issuer (optional)"
                  aria-label={`Credential ${i + 1} issuer`}
                  className="flex-1"
                />
                <Input
                  value={cred.reference}
                  onChange={(e) => updateCredential(i, { reference: e.target.value })}
                  placeholder="Reference number (optional)"
                  aria-label={`Credential ${i + 1} reference`}
                  className="flex-1"
                />
                {credentials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCredentials((rows) => rows.filter((_, idx) => idx !== i))}
                    aria-label={`Remove credential ${i + 1}`}
                    className="p-2 text-muted-foreground hover:text-rezzo-danger transition-colors shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              {/* Supporting document — optional, but this is what actually
                  lets an admin verify the claim above instead of taking the
                  type/issuer/reference text on faith. */}
              {cred.document ? (
                <div className="flex items-center gap-2 text-xs text-rezzo-navy bg-rezzo-green/5 border border-rezzo-green/20 rounded-lg px-3 py-2">
                  <FileCheck2 className="size-3.5 text-rezzo-green shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{cred.document.fileName}</span>
                  <button
                    type="button"
                    onClick={() => handleCredentialFile(i, null)}
                    aria-label={`Remove attached file for credential ${i + 1}`}
                    className="text-muted-foreground hover:text-rezzo-danger transition-colors shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-rezzo-navy cursor-pointer transition-colors w-fit">
                  <Upload className="size-3.5" />
                  <span>Attach ID, certificate, or license (optional, max 4MB)</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    aria-label={`Attach document for credential ${i + 1}`}
                    onChange={(e) => handleCredentialFile(i, e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          ))}
        </Card>

        {error && <p className="text-sm text-rezzo-danger font-medium text-center">{error}</p>}

        <Button
          className="w-full h-12 rounded-xl bg-rezzo-navy hover:bg-[#071A2B] text-white font-semibold text-sm shadow-lg gap-2"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Submit Application'}
        </Button>

        {canCancel ? (
          <button
            onClick={handleCancel}
            className="mx-auto text-xs text-muted-foreground hover:text-rezzo-navy transition-colors"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rezzo-navy transition-colors"
          >
            <LogOut className="size-3.5" />
            Not ready? Log out
          </button>
        )}
      </div>
    </div>
  )
}
