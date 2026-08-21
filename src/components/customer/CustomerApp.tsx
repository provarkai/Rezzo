'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { CustomerHome } from './CustomerHome'
import { CaseList } from './CaseList'
import { VaultView } from './VaultView'
import { CustomerProfile } from './CustomerProfile'
import { CaseWorkspace } from './CaseWorkspace'
import { Home, Shield, Folder, User } from 'lucide-react'

const TABS = [
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
    <div className="min-h-screen flex flex-col bg-[#F7F9FB]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg rezzo-gradient flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-bold text-[#102A43] text-lg tracking-tight">REZZO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hi, {firstName}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        <div className="max-w-lg mx-auto">
          {customerTab === 'home' && <CustomerHome />}
          {customerTab === 'cases' && <CaseList />}
          {customerTab === 'vault' && <VaultView />}
          {customerTab === 'profile' && <CustomerProfile />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border/60">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((tab) => {
            const isActive = customerTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setCustomerTab(tab.id)}
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
                {isActive && (
                  <div className="absolute bottom-0 w-8 h-0.5 bg-[#102A43] rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
