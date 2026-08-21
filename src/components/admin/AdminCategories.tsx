'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiGet, extractList } from '@/store/rezzo-store'
import { Tag } from 'lucide-react'

interface CategoryRow {
  id: string
  vertical: string | null
  caseCount: number
  activeSourceCount: number
}

export function AdminCategories() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet('/admin/categories')
      setCategories(extractList<CategoryRow>(data, 'categories'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchCategories}>Retry</Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-2xl">
        <Tag className="size-4 shrink-0 text-rezzo-gold mt-0.5" />
        <p>
          There's no separate Category table — AI REZZO's classifier assigns a free-string
          category per case. This shows real volume per category and which ones have no active
          Trusted Source coverage yet.
        </p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Vertical</TableHead>
              <TableHead className="text-xs">Cases</TableHead>
              <TableHead className="text-xs">Trusted Sources</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                  No categories seen yet
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs font-medium text-[#102A43]">{c.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.vertical || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.caseCount}</TableCell>
                  <TableCell>
                    {c.activeSourceCount > 0 ? (
                      <Badge className="border-0 text-xs bg-rezzo-green/10 text-rezzo-green">{c.activeSourceCount}</Badge>
                    ) : (
                      <Badge className="border-0 text-xs bg-rezzo-danger/10 text-rezzo-danger">None</Badge>
                    )}
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
