'use client'

import { useRezzoStore } from '@/store/rezzo-store'
import { CustomerApp } from '@/components/customer/CustomerApp'
import { ProfessionalApp } from '@/components/professional/ProfessionalApp'
import { AdminApp } from '@/components/admin/AdminApp'
import { Homepage } from '@/components/homepage/Homepage'

export default function Home() {
  const currentUser = useRezzoStore((s) => s.currentUser)

  if (currentUser && currentUser.role === 'CUSTOMER') {
    return <CustomerApp />
  }

  if (currentUser && currentUser.role === 'PROFESSIONAL') {
    return <ProfessionalApp />
  }

  if (currentUser && currentUser.role === 'ADMIN') {
    return <AdminApp />
  }

  return <Homepage />
}
