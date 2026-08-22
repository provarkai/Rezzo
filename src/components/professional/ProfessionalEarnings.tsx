'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { apiGet, extractList } from '@/store/rezzo-store'
import { Wallet, TrendingDown, Banknote, Clock } from 'lucide-react'

interface Transaction {
  id: string
  caseId: string
  caseNumber?: string
  service?: string
  grossAmount: number
  fee: number
  netAmount: number
  status: string
  createdAt: string
}

const COMMISSION_RATE = 0.1

export function ProfessionalEarnings() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const cases = extractList<{
        id: string
        caseNumber: string
        status: string
        title?: string
        matter?: { title?: string }
        quotes?: Array<{ totalAmount?: number; status?: string }>
        createdAt: string
      }>(await apiGet('/cases'), 'cases')

      const txs: Transaction[] = cases
        .filter((c) =>
          ['FUNDED', 'IN_PROGRESS', 'PROOF', 'COMPLETED', 'RESOLVED'].includes(
            c.status.toUpperCase()
          )
        )
        .map((c) => {
          const acceptedQuote = c.quotes?.find(
            (q) => q.status?.toUpperCase() === 'ACCEPTED'
          )
          const gross = acceptedQuote?.totalAmount ?? 0
          const fee = Math.round(gross * COMMISSION_RATE)
          const status =
            c.status.toUpperCase() === 'RESOLVED' || c.status.toUpperCase() === 'COMPLETED'
              ? 'PAID'
              : 'PENDING'
          return {
            id: c.id,
            caseId: c.id,
            caseNumber: c.caseNumber,
            service: c.matter?.title || c.title || 'Service',
            grossAmount: gross,
            fee,
            netAmount: gross - fee,
            status,
            createdAt: c.createdAt,
          }
        })

      setTransactions(txs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalGross = transactions.reduce((sum, t) => sum + t.grossAmount, 0)
  const totalFees = transactions.reduce((sum, t) => sum + t.fee, 0)
  const totalNet = transactions.reduce((sum, t) => sum + t.netAmount, 0)
  const pendingAmount = transactions
    .filter((t) => t.status === 'PENDING')
    .reduce((sum, t) => sum + t.netAmount, 0)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
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
        <Button variant="outline" size="sm" onClick={fetchData}>
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-rezzo-green flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Total Earnings</span>
          </div>
          <p className="text-2xl font-bold text-[#102A43]">{formatNaira(totalGross)}</p>
          <p className="text-xs text-muted-foreground mt-1">Gross revenue</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-rezzo-danger flex items-center justify-center">
              <TrendingDown className="size-4" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">REZZO Fees (10%)</span>
          </div>
          <p className="text-2xl font-bold text-[#102A43]">{formatNaira(totalFees)}</p>
          <p className="text-xs text-muted-foreground mt-1">Platform commission</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Banknote className="size-4" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Net Payout</span>
          </div>
          <p className="text-2xl font-bold text-rezzo-green">{formatNaira(totalNet)}</p>
          <p className="text-xs text-muted-foreground mt-1">After fees</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-rezzo-gold flex items-center justify-center">
              <Clock className="size-4" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-[#102A43]">{formatNaira(pendingAmount)}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
        </Card>
      </div>

      {/* Transaction Table (desktop) / Cards (mobile) */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border/60">
          <h2 className="text-sm font-semibold text-[#102A43]">Transactions</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet className="size-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No earnings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Earnings will appear as you complete cases
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">REZZO Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-semibold text-sm">
                        {tx.caseNumber}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {tx.service}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNaira(tx.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-rezzo-danger">
                        -{formatNaira(tx.fee)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-rezzo-green">
                        {formatNaira(tx.netAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.status === 'PAID' ? 'default' : 'outline'}
                          className={
                            tx.status === 'PAID'
                              ? 'bg-rezzo-green/10 text-rezzo-green border-0'
                              : 'bg-rezzo-gold/10 text-rezzo-gold border-0'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-lg border border-border/60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#102A43]">
                      {tx.caseNumber}
                    </span>
                    <Badge
                      variant={tx.status === 'PAID' ? 'default' : 'outline'}
                      className={
                        tx.status === 'PAID'
                          ? 'bg-rezzo-green/10 text-rezzo-green border-0'
                          : 'bg-rezzo-gold/10 text-rezzo-gold border-0'
                      }
                    >
                      {tx.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 truncate">
                    {tx.service}
                  </p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Gross: {formatNaira(tx.grossAmount)}</span>
                    <span className="text-rezzo-danger">Fee: -{formatNaira(tx.fee)}</span>
                    <span className="font-semibold text-rezzo-green">Net: {formatNaira(tx.netAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
