'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { Card } from '@/components/ui/card'
import { AdminOverview } from './AdminOverview'
import { AdminCaseQueue } from './AdminCaseQueue'
import { AdminProfessionalQueue } from './AdminProfessionalQueue'
import { AdminPayments } from './AdminPayments'
import { AdminBypassSignals } from './AdminBypassSignals'
import { AdminDisputes } from './AdminDisputes'
import { AdminCategories } from './AdminCategories'
import { AdminTrustRules } from './AdminTrustRules'
import { AdminKnowledge } from './AdminKnowledge'
import { AdminAudit } from './AdminAudit'
import { AdminSettings } from './AdminSettings'
import { AdminAnalytics } from './AdminAnalytics'
import { AdminAiOversight } from './AdminAiOversight'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  AlertTriangle,
  CreditCard,
  ShieldAlert,
  BarChart3,
  Settings,
  BadgeCheck,
  Tag,
  ShieldCheck,
  BookOpen,
  ScrollText,
  BrainCircuit,
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'cases', label: 'Cases', icon: Briefcase },
  { id: 'professionals', label: 'Professionals', icon: Users },
  { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'ai-jobs', label: 'AI Oversight', icon: BrainCircuit },
  { id: 'ai-oversight', label: 'Trust & Protection', icon: ShieldAlert },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'trust-rules', label: 'Trust Rules', icon: ShieldCheck },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export function AdminApp() {
  const adminTab = useRezzoStore((s) => s.adminTab)
  const setAdminTab = useRezzoStore((s) => s.setAdminTab)
  const currentUser = useRezzoStore((s) => s.currentUser)

  return (
    <div className="min-h-screen flex bg-[#F7F9FB]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-[#102A43] text-white min-h-screen">
        <div className="px-4 py-3.5 flex items-center gap-2 border-b border-white/10">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white font-bold text-xs">R</span>
          </div>
          <div>
            <span className="font-bold text-base tracking-tight">REZZO</span>
            <p className="text-[10px] text-white/40 leading-none">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5" aria-label="Admin navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = adminTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setAdminTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/8'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{currentUser?.name || 'Admin'}</p>
              <p className="text-[10px] text-white/40 flex items-center gap-1">
                <BadgeCheck className="size-2.5 text-rezzo-gold" />
                Administrator
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-[#102A43] text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white font-bold text-xs">R</span>
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight">REZZO</span>
                <p className="text-[10px] text-white/40 leading-none">Admin Console</p>
              </div>
            </div>
            <AdminMobileTabs currentTab={adminTab} setTab={setAdminTab} />
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-border/60">
          <h1 className="text-sm font-semibold text-[#102A43]">
            {SIDEBAR_ITEMS.find((t) => t.id === adminTab)?.label || 'Overview'}
          </h1>
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-3.5 text-rezzo-gold" />
            <span className="text-xs font-medium text-[#102A43]">{currentUser?.name || 'Admin'}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {adminTab === 'overview' && <AdminOverview />}
            {adminTab === 'cases' && <AdminCaseQueue />}
            {adminTab === 'professionals' && <AdminProfessionalQueue />}
            {adminTab === 'disputes' && <AdminDisputes />}
            {adminTab === 'payments' && <AdminPayments />}
            {adminTab === 'ai-jobs' && <AdminAiOversight />}
            {adminTab === 'ai-oversight' && <AdminBypassSignals />}
            {adminTab === 'categories' && <AdminCategories />}
            {adminTab === 'trust-rules' && <AdminTrustRules />}
            {adminTab === 'knowledge' && <AdminKnowledge />}
            {adminTab === 'audit' && <AdminAudit />}
            {adminTab === 'analytics' && <AdminAnalytics />}
            {adminTab === 'settings' && <AdminSettings />}
          </div>
        </main>
      </div>
    </div>
  )
}

function AdminMobileTabs({
  currentTab,
  setTab,
}: {
  currentTab: string
  setTab: (tab: string) => void
}) {
  // Every tab, not just the first 5 — that slice used to silently make
  // Trust & Protection, Analytics and Settings unreachable on mobile.
  return (
    <select
      value={currentTab}
      onChange={(e) => setTab(e.target.value)}
      className="bg-white/10 border border-white/20 text-white text-xs rounded-md px-2 py-1.5"
    >
      {SIDEBAR_ITEMS.map((item) => (
        <option key={item.id} value={item.id} className="text-[#102A43]">
          {item.label}
        </option>
      ))}
    </select>
  )
}
