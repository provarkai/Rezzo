'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiGet, extractList } from '@/store/rezzo-store'
import { ScrollText } from 'lucide-react'

interface AuditEntry {
  id: string
  actorName: string | null
  actorRole: string
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

export function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet('/admin/audit')
      setEntries(extractList<AuditEntry>(data, 'entries'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the audit log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchEntries}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <ScrollText className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          Every admin action that changes something — verification decisions, bypass-signal
          reviews, dispute resolutions — logged here going forward. This only covers what's been
          wired up; not every admin route writes to it yet.
        </p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">When</TableHead>
              <TableHead className="text-xs">Actor</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Resource</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                  No audit entries yet
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.actorName || 'Admin'} <span className="text-[10px]">({e.actorRole})</span>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-[#102A43]">{e.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.resourceType ? `${e.resourceType} · ${e.resourceId?.slice(0, 8)}…` : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
