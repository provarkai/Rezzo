'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings, HelpCircle, ChevronRight, MessageSquare, Shield, Repeat } from 'lucide-react'
import { toast } from 'sonner'

const MENU_ITEMS = [
  { icon: Settings, label: 'Account Settings', desc: 'Update your profile and preferences' },
  { icon: MessageSquare, label: 'Support', desc: 'Get help from the REZZO team' },
  { icon: Shield, label: 'Privacy & Security', desc: 'Manage your data and privacy' },
] as const

export function CustomerProfile() {
  const currentUser = useRezzoStore((s) => s.currentUser)
  const logout = useRezzoStore((s) => s.logout)
  const setCurrentView = useRezzoStore((s) => s.setCurrentView)
  const setActiveMode = useRezzoStore((s) => s.setActiveMode)

  const handleLogout = () => {
    logout()
    setCurrentView('landing')
    toast.success('Logged out successfully')
  }

  // Accounts that also hold a Professional record can switch sides without
  // logging out — only one mode is ever active at once, so this clears the
  // choice and drops them back on AccountModeChooser (see src/app/page.tsx).
  const isDual = !!currentUser?.professionalId
  const handleSwitchAccount = () => setActiveMode(null)

  const initials = currentUser?.name
    ?.split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-3 py-4">
        <Avatar className="size-20">
          <AvatarFallback className="bg-[#102A43] text-white text-xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h1 className="text-lg font-bold text-[#102A43]">{currentUser?.name || 'User'}</h1>
          <div className="flex flex-col gap-0.5 mt-1">
            {currentUser?.phone && (
              <p className="text-sm text-muted-foreground">{currentUser.phone}</p>
            )}
            {currentUser?.email && (
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Menu Items */}
      <div className="flex flex-col gap-2">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.label}
              className="p-4 gap-0 rounded-xl cursor-pointer rezzo-card-hover"
              onClick={() => toast.info(`${item.label} coming soon!`)}
              tabIndex={0}
              role="button"
              aria-label={item.label}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toast.info(`${item.label} coming soon!`) } }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#102A43]">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Card>
          )
        })}
      </div>

      {isDual && (
        <>
          <Separator />
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 text-sm font-medium border-rezzo-navy/20 text-rezzo-navy hover:bg-rezzo-navy/5 gap-2"
            onClick={handleSwitchAccount}
          >
            <Repeat className="size-4" />
            Switch to Professional Account
          </Button>
        </>
      )}

      <Separator />

      {/* Support Section */}
      <Card className="p-4 gap-3 border-[#102A43]/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#102A43]/5 flex items-center justify-center shrink-0">
            <HelpCircle className="size-5 text-[#102A43]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#102A43]">Need Help?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chat with our support team or email help@rezzo.ng
            </p>
          </div>
        </div>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full rounded-xl h-12 text-sm font-medium border-rezzo-danger/30 text-rezzo-danger hover:bg-rezzo-danger/5 gap-2"
        onClick={handleLogout}
      >
        <LogOut className="size-4" />
        Log Out
      </Button>

      <p className="text-center text-xs text-muted-foreground pb-4">
        REZZO v1.0.0 · Made in Nigeria 🇳🇬
      </p>
    </div>
  )
}
