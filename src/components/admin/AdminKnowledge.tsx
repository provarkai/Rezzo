'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, apiPost, extractList } from '@/store/rezzo-store'
import { BookOpen, Plus, Loader2 } from 'lucide-react'

interface SourceItem {
  id: string
  category: string
  authorityLevel: string
  title: string | null
  url: string | null
  active: boolean
  lastChecked: string | null
  contentJson?: { summary?: string; source?: string } | null
}

const AUTHORITY_LABELS: Record<string, string> = {
  A: 'Official government source',
  B: 'Verified professional guidance',
  C: 'General guidance',
}

export function AdminKnowledge() {
  const [sources, setSources] = useState<SourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [category, setCategory] = useState('')
  const [authorityLevel, setAuthorityLevel] = useState('A')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [source, setSource] = useState('')

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet('/admin/knowledge-sources')
      setSources(extractList<SourceItem>(data, 'sources'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge sources')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  const resetForm = () => {
    setCategory('')
    setAuthorityLevel('A')
    setTitle('')
    setUrl('')
    setSummary('')
    setSource('')
  }

  const handleCreate = async () => {
    if (!category.trim() || !title.trim()) return
    try {
      setSubmitting(true)
      await apiPost('/admin/knowledge-sources', {
        category: category.trim().toUpperCase().replace(/\s+/g, '_'),
        authorityLevel,
        title: title.trim(),
        url: url.trim() || undefined,
        summary: summary.trim() || undefined,
        source: source.trim() || undefined,
      })
      resetForm()
      setShowForm(false)
      await fetchSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add source')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (id: string, active: boolean) => {
    try {
      setBusyId(id)
      await apiPost(`/admin/knowledge-sources/${id}`, { active: !active })
      await fetchSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update source')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-xl">
          <BookOpen className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
          <p>
            The Trusted Sources customers see on a case (source hierarchy, PRD §12.3). Approve
            new ones, retire stale ones — retiring hides it from customers immediately, it isn't
            deleted.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="shrink-0">
          <Plus className="size-3.5 mr-1" /> Add
        </Button>
      </div>

      {error && (
        <Card className="p-3 border-rezzo-danger/30 bg-rezzo-danger/5">
          <p className="text-xs text-rezzo-danger">{error}</p>
        </Card>
      )}

      {showForm && (
        <Card className="p-4 gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. PASSPORT" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Authority Level</label>
              <select
                value={authorityLevel}
                onChange={(e) => setAuthorityLevel(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="A">A — Official government source</option>
                <option value="B">B — Verified professional guidance</option>
                <option value="C">C — General guidance</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NIN Enrollment Guide" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Issuing Body</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. NIMC" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Summary</label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
          </div>
          <Button
            size="sm"
            className="bg-[#102A43] hover:bg-[#102A43]/90 text-white w-fit"
            disabled={submitting || !category.trim() || !title.trim()}
            onClick={handleCreate}
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
            Add Source
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {sources.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground">No knowledge sources yet</Card>
        ) : (
          sources.map((s) => (
            <Card key={s.id} className={`p-3 gap-1.5 ${!s.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.category} · {AUTHORITY_LABELS[s.authorityLevel] || s.authorityLevel}
                    {s.contentJson?.source ? ` · ${s.contentJson.source}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border-0 text-xs ${s.active ? 'bg-rezzo-green/10 text-rezzo-green' : 'bg-muted text-muted-foreground'}`}>
                    {s.active ? 'Active' : 'Retired'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={busyId === s.id}
                    onClick={() => toggleActive(s.id, s.active)}
                  >
                    {busyId === s.id ? <Loader2 className="size-3 animate-spin" /> : s.active ? 'Retire' : 'Reactivate'}
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
