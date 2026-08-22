'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { CustomerHome } from './CustomerHome'
import { CaseList } from './CaseList'
import { VaultView } from './VaultView'
import { CustomerProfile } from './CustomerProfile'
import { CaseWorkspace } from './CaseWorkspace'
import { NotificationBell } from '@/components/rezzo/NotificationBell'
import { Home, Shield, Folder, User } from 'lucide-react'

// Same list drives the desktop sidebar and the mobile bottom tabs — one
// source of truth for what "ease of navigation" means on either surface,
// matching the pattern ProfessionalApp/AdminApp already use. Renamed from
// TABS since it's no longer mobile-only.
const SIDEBAR_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'cases', label: 'Cases', icon: Shield },
  { id: 'vault', label: 'Vault', icon: Folder },
  { id: 'profile', label: 'Profile', icon: User },
] as const

export function CustomerApp() {
  const customerTab = useRezzoStore((s) => s.customerTab)
  const setCustomerTab = useRezzoStore((s) => s.setCustomerTab)
  const selectedCaseId = useRezzoStore((s) => s.selectedCaseId)
  const currentUser = useRezzoStore((s) => s.currentUser)

  const firstName = currentUser?.name?.split(' ')[0] || 'User'

  if (selectedCaseId) {
    return <CaseWorkspace />
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7F9FB]">
      {/* Desktop Sidebar — this surface had none before; every screen was
          rendered inside a fixed 512px mobile column with a permanent
          bottom-tab bar, on any screen size. Customers are the largest
          user group, so this was the biggest gap in desktop navigation. */}
      <aside className="hidden md:flex flex-col w-60 bg-[#102A43] text-white min-h-screen">
        <div className="px-5 py-4 flex items-center gap-2 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-bold text-lg tracking-tight">REZZO</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Customer navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = customerTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setCustomerTab(item.id)}
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

        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold shrink-0">
              {firstName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{firstName}</p>
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Hi, {firstName}</span>
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Desktop Header Bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-4 bg-white border-b border-border/60">
          <h1 className="text-lg font-semibold text-[#102A43]">
            {SIDEBAR_ITEMS.find((t) => t.id === customerTab)?.label || 'Home'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#102A43]">Hi, {firstName}</span>
            <NotificationBell />
          </div>
        </header>

        {/* Page Content — capped at a comfortable reading width rather than
            stretched edge-to-edge on wide screens; the sidebar is what
            makes desktop's extra space useful here, not a wider column. */}
        <main className="flex-1 pb-20 md:pb-6">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 md:py-6">
            {customerTab === 'home' && <CustomerHome />}
            {customerTab === 'cases' && <CaseList />}
            {customerTab === 'vault' && <VaultView />}
            {customerTab === 'profile' && <CustomerProfile />}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border/60">
          <div className="flex">
            {SIDEBAR_ITEMS.map((tab) => {
              const isActive = customerTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setCustomerTab(tab.id)}
                  className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
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
                  {isActive && (
                    <div className="absolute bottom-0 w-8 h-0.5 bg-[#102A43] rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
