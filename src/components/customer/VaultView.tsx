'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, apiPost, apiFetch } from '@/store/rezzo-store'
import {
  Shield,
  FileText,
  Building2,
  Landmark,
  FolderOpen,
  Lock,
  Upload,
  Trash2,
  Share2,
  X,
  Loader2,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'IDENTITY', icon: FileText, label: 'Identity', desc: 'NIN, BVN, Passport, Voter Card', color: 'bg-[#102A43] text-white' },
  { id: 'PROPERTY', icon: Building2, label: 'Property', desc: 'Deeds, Certificates, Surveys', color: 'bg-[#1F7A5A] text-white' },
  { id: 'GOVERNMENT', icon: Landmark, label: 'Government', desc: 'Licenses, Permits, Tax Docs', color: 'bg-[#E0A23A] text-white' },
  { id: 'BUSINESS', icon: FolderOpen, label: 'Business', desc: 'CAC, Tax, Financial Docs', color: 'bg-[#52606D] text-white' },
  { id: 'OTHER', icon: FileText, label: 'Other', desc: 'Any other documents', color: 'bg-muted text-muted-foreground' },
] as const

interface DocumentPermissionItem {
  id: string
  caseId: string | null
  recipientUserId: string | null
  scope: string
  expiresAt: string | null
  createdAt: string
}

interface DocumentItem {
  id: string
  type: string | null
  name: string | null
  metadataJson?: { mimeType?: string; sizeBytes?: number } | null
  createdAt: string
  expiresAt: string | null
  permissions: DocumentPermissionItem[]
}

interface CaseOption {
  id: string
  caseNumber: string
  need?: { title?: string }
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // reader.result is "data:<mime>;base64,<data>" — strip the prefix
      const result = reader.result as string
      const commaIdx = result.indexOf(',')
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function VaultView() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const [busyDocId, setBusyDocId] = useState<string | null>(null)
  const [sharingDocId, setSharingDocId] = useState<string | null>(null)
  const [cases, setCases] = useState<CaseOption[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingCategoryRef = useRef<string>('OTHER')

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ documents: DocumentItem[] }>('/documents')
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your vault')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const openUploadFor = (categoryId: string) => {
    pendingCategoryRef.current = categoryId
    fileInputRef.current?.click()
  }

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('File is too large — max 4MB')
      return
    }
    const category = pendingCategoryRef.current
    try {
      setUploadingCategory(category)
      const dataBase64 = await fileToBase64(file)
      await apiPost('/documents', {
        name: file.name,
        type: category,
        mimeType: file.type || 'application/octet-stream',
        dataBase64,
      })
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingCategory(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setBusyDocId(id)
      await apiFetch(`/documents/${id}`, { method: 'DELETE' })
      setDocuments((docs) => docs.filter((d) => d.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyDocId(null)
    }
  }

  const openSharePicker = async (docId: string) => {
    if (sharingDocId === docId) {
      setSharingDocId(null)
      return
    }
    setSharingDocId(docId)
    if (cases.length === 0) {
      try {
        const data = await apiGet<{ cases: CaseOption[] }>('/cases')
        setCases(data.cases || [])
      } catch {
        setCases([])
      }
    }
  }

  const handleShare = async (docId: string, caseId: string) => {
    try {
      setBusyDocId(docId)
      await apiPost(`/documents/${docId}/share`, { caseId })
      setSharingDocId(null)
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share this document')
    } finally {
      setBusyDocId(null)
    }
  }

  const handleRevoke = async (docId: string, permissionId: string) => {
    try {
      setBusyDocId(docId)
      await apiPost(`/documents/${docId}/revoke`, { permissionId })
      await fetchDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke this share')
    } finally {
      setBusyDocId(null)
    }
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#102A43]">REZZO Vault</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Securely store documents for your cases
        </p>
      </div>

      {/* Security Banner */}
      <Card className="p-4 gap-3 border-[#1F7A5A]/20 bg-[#1F7A5A]/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1F7A5A]/10 flex items-center justify-center">
            <Lock className="size-4 text-[#1F7A5A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F7A5A]">Private by default</p>
            <p className="text-xs text-muted-foreground">
              Only shared with a professional when you explicitly choose to, for one case at a time.
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-3 border-rezzo-danger/30 bg-rezzo-danger/5">
          <p className="text-xs text-rezzo-danger">{error}</p>
        </Card>
      )}

      {/* Categories */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#102A43]">Document Categories</h2>
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const count = documents.filter((d) => d.type === cat.id).length
            const isUploading = uploadingCategory === cat.id
            return (
              <Card key={cat.id} className="p-4 gap-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#102A43]">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.desc}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{count} doc{count === 1 ? '' : 's'}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    disabled={isUploading}
                    onClick={() => openUploadFor(cat.id)}
                    aria-label={`Upload to ${cat.label}`}
                  >
                    {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
            <Shield className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-[#102A43]">No documents yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
            Tap the upload icon on a category above to add your first document.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[#102A43]">Your Documents ({documents.length})</h2>
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-3 gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name || 'Untitled'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(doc.metadataJson?.sizeBytes)} · {new Date(doc.createdAt).toLocaleDateString('en-NG')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openSharePicker(doc.id)}
                      aria-label="Share"
                    >
                      <Share2 className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rezzo-danger hover:text-rezzo-danger"
                      disabled={busyDocId === doc.id}
                      onClick={() => handleDelete(doc.id)}
                      aria-label="Delete"
                    >
                      {busyDocId === doc.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                {doc.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {doc.permissions.map((p) => {
                      const caseInfo = cases.find((c) => c.id === p.caseId)
                      return (
                        <span
                          key={p.id}
                          className="text-[10px] px-2 py-1 rounded-full bg-[#1F7A5A]/10 text-[#1F7A5A] flex items-center gap-1"
                        >
                          Shared with {caseInfo?.caseNumber || 'a case'}
                          <button onClick={() => handleRevoke(doc.id, p.id)} aria-label="Revoke share">
                            <X className="size-2.5" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                {sharingDocId === doc.id && (
                  <div className="pt-1 border-t border-border/60">
                    <p className="text-[11px] text-muted-foreground mb-1.5">Share with which case?</p>
                    {cases.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No cases yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {cases.map((c) => (
                          <button
                            key={c.id}
                            disabled={busyDocId === doc.id}
                            onClick={() => handleShare(doc.id, c.id)}
                            className="text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted flex items-center justify-between"
                          >
                            <span>{c.caseNumber} — {c.need?.title || 'Untitled case'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
