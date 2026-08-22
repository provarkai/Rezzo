'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { Card } from '@/components/ui/card'
import { User, Wrench, ArrowRight, LogOut } from 'lucide-react'

/**
 * Shown right after login for an account that holds both a customer and a
 * professional identity (User.professional exists alongside the baseline
 * customer capability every non-admin account has). Also reused whenever
 * that kind of account explicitly switches sides via "Switch account" in
 * CustomerProfile / the professional profile tab. Only one mode is ever
 * active at once — this screen is the only place that changes it.
 */
export function AccountModeChooser() {
  const currentUser = useRezzoStore((s) => s.currentUser)
  const setActiveMode = useRezzoStore((s) => s.setActiveMode)
  const logout = useRezzoStore((s) => s.logout)

  const firstName = currentUser?.name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB] px-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-rezzo-navy">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Your account is set up as both a customer and a professional.
            Choose which one to use now — you can switch later, but only
            one is active at a time.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Card
            className="p-5 rounded-2xl cursor-pointer rezzo-card-hover flex items-center gap-4"
            onClick={() => setActiveMode('CUSTOMER')}
            role="button"
            tabIndex={0}
            aria-label="Continue as Customer"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveMode('CUSTOMER') } }}
          >
            <div className="w-12 h-12 rounded-xl bg-rezzo-green/10 flex items-center justify-center shrink-0">
              <User className="size-5 text-rezzo-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rezzo-navy">Continue as Customer</p>
              <p className="text-xs text-muted-foreground">Create cases and get help</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
          </Card>

          <Card
            className="p-5 rounded-2xl cursor-pointer rezzo-card-hover flex items-center gap-4"
            onClick={() => setActiveMode('PROFESSIONAL')}
            role="button"
            tabIndex={0}
            aria-label="Continue as Professional"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveMode('PROFESSIONAL') } }}
          >
            <div className="w-12 h-12 rounded-xl bg-rezzo-gold/10 flex items-center justify-center shrink-0">
              <Wrench className="size-5 text-rezzo-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rezzo-navy">Continue as Professional</p>
              <p className="text-xs text-muted-foreground">Manage cases and earnings</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
          </Card>
        </div>

        <button
          onClick={logout}
          className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rezzo-navy transition-colors"
        >
          <LogOut className="size-3.5" />
          Not you? Log out
        </button>
      </div>
    </div>
  )
}
