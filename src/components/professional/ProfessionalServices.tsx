'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatNaira } from '@/components/rezzo/NairaInput'
import { apiGet, apiPost, extractList } from '@/store/rezzo-store'
import { Wrench, Plus, ToggleLeft, ToggleRight } from 'lucide-react'

interface Service {
  id: string
  name: string
  pricingType: string
  price: number
  isActive: boolean
  description?: string
}

export function ProfessionalServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form state
  const [newName, setNewName] = useState('')
  const [newPricingType, setNewPricingType] = useState('FIXED')
  const [newPrice, setNewPrice] = useState('')

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // For V1, we use a placeholder. The API doesn't have a dedicated services endpoint
      // so we show a sensible default set
      const cases = extractList<{ matter?: { category?: string } }>(await apiGet('/cases'), 'cases')
      const categories = [...new Set(cases.map((c) => c.matter?.category).filter(Boolean))]
      if (categories.length > 0) {
        setServices(
          categories.slice(0, 5).map((cat, i) => ({
            id: `svc-${i}`,
            name: cat || `Service ${i + 1}`,
            pricingType: 'FIXED',
            price: [15000, 25000, 35000, 50000, 75000][i] || 25000,
            isActive: true,
          }))
        )
      } else {
        // Default placeholder services
        setServices([
          { id: 'svc-1', name: 'AC Repair & Maintenance', pricingType: 'FIXED', price: 25000, isActive: true },
          { id: 'svc-2', name: 'Generator Servicing', pricingType: 'FIXED', price: 35000, isActive: true },
          { id: 'svc-3', name: 'Electrical Wiring', pricingType: 'RANGE', price: 50000, isActive: true },
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleAddService = () => {
    if (!newName.trim()) return
    const rawPrice = newPrice.replace(/[^0-9]/g, '')
    const service: Service = {
      id: `svc-new-${Date.now()}`,
      name: newName.trim(),
      pricingType: newPricingType,
      price: rawPrice ? parseInt(rawPrice, 10) : 0,
      isActive: true,
    }
    setServices((prev) => [...prev, service])
    setNewName('')
    setNewPrice('')
    setNewPricingType('FIXED')
    setDialogOpen(false)
  }

  const toggleService = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rezzo-danger mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchServices}>
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#102A43]">My Services</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {services.filter((s) => s.isActive).length} active services
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#102A43] hover:bg-[#102A43]/90 text-white">
              <Plus className="size-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Service Name
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. AC Installation"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Pricing Type
                </label>
                <select
                  value={newPricingType}
                  onChange={(e) => setNewPricingType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  <option value="FIXED">Fixed Price</option>
                  <option value="RANGE">Price Range</option>
                  <option value="HOURLY">Hourly Rate</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Starting Price
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground font-medium text-sm pointer-events-none">
                    ₦
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={newPrice}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      if (raw === '') {
                        setNewPrice('')
                        return
                      }
                      setNewPrice(parseInt(raw, 10).toLocaleString())
                    }}
                    placeholder="0"
                    className="pl-8"
                  />
                </div>
              </div>
              <Button
                className="w-full bg-[#102A43] hover:bg-[#102A43]/90 text-white"
                disabled={!newName.trim()}
                onClick={handleAddService}
              >
                Add Service
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Service Cards */}
      {services.length === 0 ? (
        <Card className="p-8 text-center">
          <Wrench className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-[#102A43]">No services yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add services to get matched with relevant cases
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <Card key={svc.id} className="p-4 rounded-xl border-border/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#102A43]">
                      {svc.name}
                    </span>
                    <Badge
                      variant={svc.isActive ? 'default' : 'outline'}
                      className={
                        svc.isActive
                          ? 'bg-rezzo-green/10 text-rezzo-green border-0 text-xs'
                          : 'bg-muted text-muted-foreground border-0 text-xs'
                      }
                    >
                      {svc.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="capitalize">{svc.pricingType.toLowerCase()}</span>
                    <span>•</span>
                    <span className="font-medium text-foreground">
                      {formatNaira(svc.price)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleService(svc.id)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label={svc.isActive ? 'Deactivate service' : 'Activate service'}
                >
                  {svc.isActive ? (
                    <ToggleRight className="size-5 text-rezzo-green" />
                  ) : (
                    <ToggleLeft className="size-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
