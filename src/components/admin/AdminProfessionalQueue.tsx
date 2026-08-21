'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TrustScore } from '@/components/rezzo/TrustScore'
import { apiGet, apiPost, extractList } from '@/store/rezzo-store'
import { Check, X, Shield, MapPin, Star, Loader2 } from 'lucide-react'

interface Professional {
  id: string
  name: string
  profession?: string
  serviceArea?: string
  verificationStatus: string
  trustScore: number
  skills?: Array<{ name?: string }>
  credentials?: Array<{ type?: string; status?: string }>
  createdAt: string
}

const VERIFY_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending', statuses: ['PENDING', 'NEEDS_INFO'] },
  { id: 'approved', label: 'Approved', statuses: ['APPROVED', 'VERIFIED'] },
  { id: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
] as const

export function AdminProfessionalQueue() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<Professional | null>(null)

  const fetchProfessionals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet('/admin/professionals')
      setProfessionals(extractList<Professional>(data, 'professionals'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load professionals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfessionals()
  }, [fetchProfessionals])

  const filtered = professionals.filter((p) => {
    if (statusFilter === 'all') return true
    const filterObj = VERIFY_STATUS_FILTERS.find((f) => f.id === statusFilter)
    if (!filterObj || !('statuses' in filterObj)) return true
    return filterObj.statuses.includes(p.verificationStatus.toUpperCase())
  })

  const handleVerify = async (pro: Professional) => {
    try {
      setActionLoading(pro.id)
      await apiPost(`/admin/verification/${pro.id}`, { status: 'APPROVED' })
      await fetchProfessionals()
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectOpen = (pro: Professional) => {
    setRejectTarget(pro)
    setRejectNotes('')
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    try {
      setActionLoading(rejectTarget.id)
      await apiPost(`/admin/verification/${rejectTarget.id}`, {
        status: 'REJECTED',
        notes: rejectNotes || undefined,
      })
      setRejectDialogOpen(false)
      await fetchProfessionals()
    } catch {
      // silent
    } finally {
      setActionLoading(null)
      setRejectTarget(null)
    }
  }

  const getVerificationBadge = (status: string) => {
    const s = status.toUpperCase()
    if (['APPROVED', 'VERIFIED'].includes(s)) {
      return <Badge className="bg-rezzo-green/10 text-rezzo-green border-0 text-xs">Verified</Badge>
    }
    if (['REJECTED'].includes(s)) {
      return <Badge className="bg-rezzo-danger/10 text-rezzo-danger border-0 text-xs">Rejected</Badge>
    }
    return <Badge className="bg-rezzo-gold/10 text-rezzo-gold border-0 text-xs">Pending</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchProfessionals}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto">
        {VERIFY_STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#102A43] text-white'
                  : 'bg-white text-muted-foreground hover:text-foreground border border-border/60'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Desktop Table */}
      <Card className="overflow-hidden">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Profession</TableHead>
                <TableHead className="text-xs">Service Area</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Trust Score</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No professionals found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((pro) => (
                  <TableRow key={pro.id}>
                    <TableCell>
                      <button
                        onClick={() => { setSelectedPro(pro); setDetailOpen(true) }}
                        className="text-xs font-semibold text-[#102A43] hover:underline"
                      >
                        {pro.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pro.profession || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pro.serviceArea || '—'}
                    </TableCell>
                    <TableCell>{getVerificationBadge(pro.verificationStatus)}</TableCell>
                    <TableCell className="text-xs font-medium">{pro.trustScore}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pro.verificationStatus.toUpperCase() !== 'APPROVED' &&
                          pro.verificationStatus.toUpperCase() !== 'VERIFIED' && (
                          <>
                            <Button
                              size="icon"
                              className="h-7 w-7 bg-rezzo-green/10 text-rezzo-green hover:bg-rezzo-green/20"
                              onClick={() => handleVerify(pro)}
                              disabled={actionLoading === pro.id}
                            >
                              {actionLoading === pro.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              className="h-7 w-7 bg-rezzo-danger/10 text-rezzo-danger hover:bg-rezzo-danger/20"
                              onClick={() => handleRejectOpen(pro)}
                              disabled={actionLoading === pro.id}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No professionals found</p>
          ) : (
            filtered.map((pro) => (
              <div
                key={pro.id}
                className="p-3 rounded-lg border border-border/60"
              >
                <div className="flex items-start justify-between mb-2">
                  <button
                    onClick={() => { setSelectedPro(pro); setDetailOpen(true) }}
                    className="text-xs font-semibold text-[#102A43] hover:underline text-left"
                  >
                    {pro.name}
                  </button>
                  {getVerificationBadge(pro.verificationStatus)}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                  {pro.profession && <span>{pro.profession}</span>}
                  {pro.serviceArea && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="size-2.5" />
                        {pro.serviceArea}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Shield className="size-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{pro.trustScore}</span>
                  </div>
                  {pro.verificationStatus.toUpperCase() !== 'APPROVED' &&
                    pro.verificationStatus.toUpperCase() !== 'VERIFIED' && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        className="h-6 w-6 bg-rezzo-green/10 text-rezzo-green hover:bg-rezzo-green/20"
                        onClick={() => handleVerify(pro)}
                        disabled={actionLoading === pro.id}
                      >
                        {actionLoading === pro.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        className="h-6 w-6 bg-rezzo-danger/10 text-rezzo-danger hover:bg-rezzo-danger/20"
                        onClick={() => handleRejectOpen(pro)}
                        disabled={actionLoading === pro.id}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Professional Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPro?.name}
              {selectedPro && getVerificationBadge(selectedPro.verificationStatus)}
            </DialogTitle>
          </DialogHeader>
          {selectedPro && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">Profession</h3>
                  <p className="text-foreground">{selectedPro.profession || '—'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">Service Area</h3>
                  <p className="text-foreground">{selectedPro.serviceArea || '—'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">Joined</h3>
                  <p className="text-foreground">
                    {new Date(selectedPro.createdAt).toLocaleDateString('en-NG')}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Trust Score</h3>
                <TrustScore score={selectedPro.trustScore} />
              </div>

              {selectedPro.skills && selectedPro.skills.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPro.skills.map((sk, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {sk.name || 'Skill'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedPro.credentials && selectedPro.credentials.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">Credentials</h3>
                    <div className="space-y-1.5">
                      {selectedPro.credentials.map((cred, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span>{cred.type || 'Credential'}</span>
                          {getVerificationBadge(cred.status || 'PENDING')}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to reject <strong>{rejectTarget?.name}</strong>? This action can be reversed later.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Notes (optional)
              </label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rezzo-danger hover:bg-rezzo-danger/90 text-white"
                onClick={handleRejectConfirm}
                disabled={actionLoading !== null}
              >
                {actionLoading ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
