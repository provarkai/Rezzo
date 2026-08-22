'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ProfessionalDashboard } from './ProfessionalDashboard'
import { ProfessionalCaseList } from './ProfessionalCaseList'
import { ProfessionalCaseDetail } from './ProfessionalCaseDetail'
import { ProfessionalEarnings } from './ProfessionalEarnings'
import { ProfessionalServices } from './ProfessionalServices'
import { ProfessionalTrust } from './ProfessionalTrust'
import { ProfessionalVerificationStatus } from './ProfessionalVerificationStatus'
import { NotificationBell } from '@/components/rezzo/NotificationBell'
import { isVerificationActive } from '@/lib/domain/constants'
import {
  LayoutDashboard,
  Briefcase,
  Wrench,
  Wallet,
  Shield,
  User,
  BadgeCheck,
  Repeat,
  LogOut,
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'cases', label: 'Cases', icon: Briefcase },
  { id: 'services', label: 'Services', icon: Wrench },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'trust', label: 'Trust', icon: Shield },
  { id: 'profile', label: 'Profile', icon: User },
] as const

export function ProfessionalApp() {
  const professionalTab = useRezzoStore((s) => s.professionalTab)
  const setProfessionalTab = useRezzoStore((s) => s.setProfessionalTab)
  const proSelectedCaseId = useRezzoStore((s) => s.proSelectedCaseId)
  const setProSelectedCaseId = useRezzoStore((s) => s.setProSelectedCaseId)
  const currentUser = useRezzoStore((s) => s.currentUser)

  const firstName = currentUser?.name?.split(' ')[0] || 'Professional'

  // A Professional record existing isn't the same as being allowed to work
  // cases — verification is staged (PENDING/NEEDS_INFO -> VERIFIED and up,
  // see isVerificationActive). Gate the whole shell on it rather than just
  // hiding a button, since case-accepting actions are the point of this app.
  if (!isVerificationActive(currentUser?.verificationStatus)) {
    return <ProfessionalVerificationStatus />
  }

  if (proSelectedCaseId) {
    return <ProfessionalCaseDetail />
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F9FB]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#102A43] text-white min-h-screen">
        {/* Brand */}
        <div className="px-5 py-4 flex items-center gap-2 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-bold text-lg tracking-tight">REZZO</span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Professional navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = professionalTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setProfessionalTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* User Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">
              {firstName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{firstName}</p>
              <div className="flex items-center gap-1 text-xs text-white/50">
                <BadgeCheck className="size-3 text-rezzo-gold" />
                <span>Verified Pro</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg rezzo-gradient flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <span className="font-bold text-[#102A43] text-lg tracking-tight">REZZO</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-rezzo-gold" />
                <span className="text-sm text-muted-foreground">{firstName}</span>
              </div>
              <NotificationBell onSelectCase={setProSelectedCaseId} />
            </div>
          </div>
        </header>

        {/* Desktop Header Bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-border/60">
          <div>
            <h1 className="text-lg font-semibold text-[#102A43]">
              {SIDEBAR_ITEMS.find((t) => t.id === professionalTab)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-rezzo-gold" />
              <span className="text-sm font-medium text-[#102A43]">{currentUser?.name || 'Professional'}</span>
            </div>
            <NotificationBell onSelectCase={setProSelectedCaseId} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pb-20 md:pb-6">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6">
            {professionalTab === 'dashboard' && <ProfessionalDashboard />}
            {professionalTab === 'cases' && <ProfessionalCaseList />}
            {professionalTab === 'services' && <ProfessionalServices />}
            {professionalTab === 'earnings' && <ProfessionalEarnings />}
            {professionalTab === 'trust' && <ProfessionalTrust />}
            {professionalTab === 'profile' && <ProfessionalProfilePlaceholder />}
          </div>
        </main>

        {/* Mobile Bottom Tabs */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border/60">
          <div className="flex">
            {SIDEBAR_ITEMS.map((tab) => {
              const isActive = professionalTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setProfessionalTab(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
                    isActive
                      ? 'text-[#102A43]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`size-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}

function ProfessionalProfilePlaceholder() {
  const currentUser = useRezzoStore((s) => s.currentUser)
  const setActiveMode = useRezzoStore((s) => s.setActiveMode)
  const logout = useRezzoStore((s) => s.logout)
  const setCurrentView = useRezzoStore((s) => s.setCurrentView)

  // See CustomerProfile.tsx's equivalent — this account also has customer
  // access underneath the professional identity (every non-admin account
  // does); "Switch account" just clears the active mode, it never logs out.
  const isDual = !!currentUser?.professionalId

  const handleLogout = () => {
    logout()
    setCurrentView('landing')
    toast.success('Logged out successfully')
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#102A43] flex items-center justify-center text-white text-xl font-bold">
            {currentUser?.name?.charAt(0) || 'P'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#102A43]">{currentUser?.name || 'Professional'}</h2>
            <p className="text-sm text-muted-foreground">{currentUser?.phone || ''}</p>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-[#102A43] mb-4">Account Settings</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex justify-between py-2 border-b border-border/60">
            <span>Phone</span>
            <span className="text-foreground">{currentUser?.phone || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/60">
            <span>Role</span>
            <span className="text-foreground">Professional</span>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-3">
        {isDual && (
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 text-sm font-medium border-rezzo-navy/20 text-rezzo-navy hover:bg-rezzo-navy/5 gap-2"
            onClick={() => setActiveMode(null)}
          >
            <Repeat className="size-4" />
            Switch to Customer Account
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full rounded-xl h-12 text-sm font-medium border-rezzo-danger/30 text-rezzo-danger hover:bg-rezzo-danger/5 gap-2"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Log Out
        </Button>
      </div>
    </div>
  )
}
