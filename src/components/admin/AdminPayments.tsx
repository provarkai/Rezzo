'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { apiGet, extractList } from '@/store/rezzo-store'
import { DollarSign, TrendingDown, Clock, CreditCard } from 'lucide-react'

interface Payment {
  id: string
  caseId: string
  caseNumber?: string
  amount: number
  commission: number
  status: string
  createdAt: string
  professionalName?: string
}

const PAYMENT_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending', statuses: ['PENDING', 'PROCESSING'] },
  { id: 'success', label: 'Success', statuses: ['SUCCESS', 'COMPLETED'] },
  { id: 'failed', label: 'Failed', statuses: ['FAILED'] },
] as const

export function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // Fetch admin cases which include payment data
      const cases = extractList<{
        id: string
        caseNumber: string
        status: string
        createdAt: string
        quotes?: Array<{ totalAmount?: number; status?: string }>
        professional?: { name?: string }
      }>(await apiGet('/admin/cases'), 'cases')

      const txs: Payment[] = cases
        .filter((c) =>
          ['PAYMENT', 'FUNDED', 'IN_PROGRESS', 'PROOF', 'COMPLETED', 'RESOLVED'].includes(
            c.status.toUpperCase()
          )
        )
        .map((c) => {
          const acceptedQuote = c.quotes?.find(
            (q) => q.status?.toUpperCase() === 'ACCEPTED'
          )
          const amount = acceptedQuote?.totalAmount ?? 0
          const commission = Math.round(amount * 0.1)
          const status =
            c.status.toUpperCase() === 'PAYMENT'
              ? 'PENDING'
              : c.status.toUpperCase() === 'RESOLVED' || c.status.toUpperCase() === 'COMPLETED'
                ? 'SUCCESS'
                : 'SUCCESS'
          return {
            id: c.id,
            caseId: c.id,
            caseNumber: c.caseNumber,
            amount,
            commission,
            status,
            createdAt: c.createdAt,
            professionalName: c.professional?.name,
          }
        })

      setPayments(txs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const filtered = payments.filter((p) => {
    if (statusFilter === 'all') return true
    const filterObj = PAYMENT_STATUS_FILTERS.find((f) => f.id === statusFilter)
    if (!filterObj || !('statuses' in filterObj)) return true
    return filterObj.statuses.includes(p.status.toUpperCase())
  })

  const totalGMV = payments.reduce((sum, p) => sum + p.amount, 0)
  const totalCommission = payments.reduce((sum, p) => sum + p.commission, 0)
  const pendingPayouts = payments
    .filter((p) => ['PENDING', 'PROCESSING'].includes(p.status.toUpperCase()))
    .reduce((sum, p) => sum + p.amount, 0)

  const getPaymentBadge = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'SUCCESS' || s === 'COMPLETED') {
      return <Badge className="bg-rezzo-green/10 text-rezzo-green border-0 text-xs">Success</Badge>
    }
    if (s === 'FAILED') {
      return <Badge className="bg-rezzo-danger/10 text-rezzo-danger border-0 text-xs">Failed</Badge>
    }
    return <Badge className="bg-rezzo-gold/10 text-rezzo-gold border-0 text-xs">Pending</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
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
        <Button variant="outline" size="sm" onClick={fetchPayments}>
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="size-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">Total GMV</span>
          </div>
          <p className="text-base font-bold text-[#102A43]">{formatNaira(totalGMV)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="size-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">Total Commission</span>
          </div>
          <p className="text-base font-bold text-rezzo-green">{formatNaira(totalCommission)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">Pending Payouts</span>
          </div>
          <p className="text-base font-bold text-rezzo-gold">{formatNaira(pendingPayouts)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto">
        {PAYMENT_STATUS_FILTERS.map((f) => {
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

      {/* Transaction Table - Desktop */}
      <Card className="overflow-hidden">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Case</TableHead>
                <TableHead className="text-xs">Professional</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs text-right">Commission</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {tx.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{tx.caseNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.professionalName || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatNaira(tx.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-right text-rezzo-green">
                      {formatNaira(tx.commission)}
                    </TableCell>
                    <TableCell>{getPaymentBadge(tx.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                      })}
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
            <p className="text-xs text-muted-foreground text-center py-8">No transactions found</p>
          ) : (
            filtered.map((tx) => (
              <div key={tx.id} className="p-3 rounded-lg border border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#102A43]">{tx.caseNumber}</span>
                  {getPaymentBadge(tx.status)}
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  {tx.professionalName || 'Professional'} • {new Date(tx.createdAt).toLocaleDateString('en-NG')}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount: {formatNaira(tx.amount)}</span>
                  <span className="font-medium text-rezzo-green">Fee: {formatNaira(tx.commission)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
