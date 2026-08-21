'use client'

import { Input } from '@/components/ui/input'

interface NairaInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function NairaInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
}: NairaInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') {
      onChange('')
      return
    }
    const num = parseInt(raw, 10)
    onChange(num.toLocaleString())
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3 text-muted-foreground font-medium text-sm pointer-events-none">
        ₦
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={value ? `₦${value}` : ''}
        onChange={handleChange}
        placeholder={`₦${placeholder}`}
        disabled={disabled}
        className="pl-8"
      />
    </div>
  )
}

export function formatNaira(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '₦0'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₦0'
  return `₦${num.toLocaleString()}`
}
