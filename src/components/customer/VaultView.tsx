'use client'

import { Card } from '@/components/ui/card'
import { 
  Shield, 
  FileText, 
  Building2, 
  Landmark, 
  FolderOpen, 
  Lock 
} from 'lucide-react'

const CATEGORIES = [
  { icon: FileText, label: 'Identity', desc: 'NIN, BVN, Passport, Voter Card', color: 'bg-[#102A43] text-white' },
  { icon: Building2, label: 'Property', desc: 'Deeds, Certificates, Surveys', color: 'bg-[#1F7A5A] text-white' },
  { icon: Landmark, label: 'Government', desc: 'Licenses, Permits, Tax Docs', color: 'bg-[#E0A23A] text-white' },
  { icon: FolderOpen, label: 'Business', desc: 'CAC, Tax, Financial Docs', color: 'bg-[#52606D] text-white' },
  { icon: FileText, label: 'Other', desc: 'Any other documents', color: 'bg-muted text-muted-foreground' },
] as const

export function VaultView() {
  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#102A43]">REZZO Vault</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Securely store documents for your cases
        </p>
      </div>

      {/* Security Banner */}
      <Card className="p-4 gap-3 border-[#1F7A5A]/20 bg-[#1F7A5A]/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1F7A5A]/10 flex items-center justify-center">
            <Lock className="size-4 text-[#1F7A5A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F7A5A]">Bank-Grade Security</p>
            <p className="text-xs text-muted-foreground">
              Your documents are encrypted and only shared with verified professionals you approve.
            </p>
          </div>
        </div>
      </Card>

      {/* Categories */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#102A43]">Document Categories</h2>
        <div className="flex flex-col gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <Card key={cat.label} className="p-4 gap-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#102A43]">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.desc}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">0 docs</span>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Empty State */}
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
          <Shield className="size-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-[#102A43]">No documents yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
          When you create a case, REZZO will suggest documents to upload to your secure vault.
        </p>
      </div>
    </div>
  )
}
