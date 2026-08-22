'use client'

import { useEffect } from 'react'
import { useRezzoStore } from '@/store/rezzo-store'
import { CustomerApp } from '@/components/customer/CustomerApp'
import { ProfessionalApp } from '@/components/professional/ProfessionalApp'
import { AdminApp } from '@/components/admin/AdminApp'
import { Homepage } from '@/components/homepage/Homepage'
import { AccountModeChooser } from '@/components/rezzo/AccountModeChooser'
import { ProfessionalApply } from '@/components/professional/ProfessionalApply'

export default function Home() {
  const currentUser = useRezzoStore((s) => s.currentUser)
  const activeMode = useRezzoStore((s) => s.activeMode)
  const setActiveMode = useRezzoStore((s) => s.setActiveMode)
  const professionalApplyOpen = useRezzoStore((s) => s.professionalApplyOpen)

  // Every non-admin account can act as a customer; a Professional record is
  // an addition on top, not a replacement of that — so an account that has
  // one is "dual" and needs to pick which side is active right now
  // (AccountModeChooser). A bare role of 'PROFESSIONAL' with no Professional
  // record yet (registered but hasn't applied) isn't dual, just professional
  // — same single-identity behavior as always, no chooser.
  const hasProfessionalRecord = !!currentUser?.professionalId
  const isProfessionalRole = currentUser?.role === 'PROFESSIONAL'
  const isDual = !!currentUser && currentUser.role !== 'ADMIN' && hasProfessionalRecord
  const defaultMode: 'CUSTOMER' | 'PROFESSIONAL' = isProfessionalRole || hasProfessionalRecord ? 'PROFESSIONAL' : 'CUSTOMER'

  // The apply form takes over whenever there's an application to finish:
  // explicitly opened from a profile menu, or registered as PROFESSIONAL
  // without ever submitting one. verificationStatus once submitted (PENDING
  // and up) is a ProfessionalApp concern (ProfessionalVerificationStatus),
  // not this one.
  const needsApplication = !!currentUser && currentUser.role !== 'ADMIN' &&
    (professionalApplyOpen || (isProfessionalRole && !hasProfessionalRecord))

  useEffect(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || activeMode || isDual) return
    setActiveMode(defaultMode)
  }, [currentUser, activeMode, isDual, defaultMode, setActiveMode])

  if (!currentUser) return <Homepage />
  if (currentUser.role === 'ADMIN') return <AdminApp />
  if (needsApplication) return <ProfessionalApply />
  if (isDual && !activeMode) return <AccountModeChooser />
  if (activeMode === 'PROFESSIONAL') return <ProfessionalApp />
  if (activeMode === 'CUSTOMER') return <CustomerApp />

  // Single-identity account whose mode the effect above is about to set —
  // avoids flashing the wrong shell for one frame.
  return null
}
