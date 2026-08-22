'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRezzoStore, apiPost, ApiError } from '@/store/rezzo-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ChevronRight, ArrowRight, Shield, Zap, Users, Clock,
  Home, Building2, Briefcase, FileText, CheckCircle2,
  Phone, User, Wrench, Lock, Eye, Loader2, X, Menu,
  ChevronDown, MessageSquare, Search, Sparkles,
  BadgeCheck, Wallet, Headphones, ArrowUpRight
} from 'lucide-react'
import { toast } from 'sonner'
import { GuestPortal } from './GuestPortal'

// ─── Hero Questions (Rotating) ──────────────────────────────────────────────
const HERO_QUESTIONS = [
  'What is the problem?',
  'What do you need?',
  'What is the matter?',
]

// ─── Verticals ───────────────────────────────────────────────────────────────
const VERTICALS = [
  {
    icon: Home,
    title: 'Home & Technical',
    desc: 'AC repair, plumbing, electrical work, deep cleaning, pest control, and every home maintenance need — handled by verified technicians.',
    color: 'bg-[#1F7A5A]/10',
    iconColor: 'text-[#1F7A5A]',
    borderAccent: 'border-l-[#1F7A5A]',
    examples: ['AC not cooling', 'Plumbing leaks', 'Electrical faults', 'Deep cleaning'],
  },
  {
    icon: Building2,
    title: 'Property & Housing',
    desc: 'Rent disputes, property verification, tenancy agreements, landlord mediation, and housing search — resolved with clarity and proof.',
    color: 'bg-[#2B6CB0]/10',
    iconColor: 'text-[#2B6CB0]',
    borderAccent: 'border-l-[#2B6CB0]',
    examples: ['Rent dispute', 'Property verification', 'Tenancy agreement', 'Landlord issue'],
  },
  {
    icon: Briefcase,
    title: 'Business & Enterprise',
    desc: 'Business registration, tax compliance, accounting services, legal advisory, and corporate solutions — from professionals who know Nigeria.',
    color: 'bg-[#E0A23A]/10',
    iconColor: 'text-[#E0A23A]',
    borderAccent: 'border-l-[#E0A23A]',
    examples: ['CAC registration', 'Tax filing', 'Bookkeeping', 'Legal advisory'],
  },
  {
    icon: FileText,
    title: 'Government & Documentation',
    desc: 'Passport processing, BVN issues, vehicle registration, certificate verification, and official document assistance — no runaround.',
    color: 'bg-[#102A43]/10',
    iconColor: 'text-[#102A43]',
    borderAccent: 'border-l-[#102A43]',
    examples: ['Passport renewal', 'BVN resolution', 'Vehicle papers', 'Document verification'],
  },
] as const

// ─── How It Works Steps ──────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    title: 'Tell REZZO',
    subtitle: 'State your need',
    desc: 'Describe your problem in plain language — type it, say it, or show it. No forms to fill, no categories to browse. Just say what\'s wrong.',
    icon: MessageSquare,
  },
  {
    num: '02',
    title: 'REZZO Understands',
    subtitle: 'AI analysis & routing',
    desc: 'Our AI engine analyses your need, classifies the problem, and routes it to the most qualified verified professionals near you.',
    icon: Zap,
  },
  {
    num: '03',
    title: 'Get Your Quote',
    subtitle: 'Transparent pricing',
    desc: 'Receive clear, detailed quotes from matched professionals. Compare pricing, reviews, and availability — then accept on your terms.',
    icon: Wallet,
  },
  {
    num: '04',
    title: 'Resolved',
    subtitle: 'Delivered & verified',
    desc: 'The professional completes the work and submits proof. REZZO verifies everything before releasing your payment. Done.',
    icon: CheckCircle2,
  },
] as const

// ─── Trust Signals ───────────────────────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: BadgeCheck, title: 'Verified Professionals', desc: 'Every professional passes identity verification, skills assessment, and background checks before accepting a single case.' },
  { icon: Lock, title: 'Payment Protection', desc: 'Your money is held in escrow and only released after you confirm the work is done to your satisfaction.' },
  { icon: Sparkles, title: 'AI-Powered Matching', desc: 'Our engine understands the nuances of your need and finds the best-fit professional — not just the nearest one.' },
  { icon: Headphones, title: 'Real Human Support', desc: 'For disputes, escalations, or anything the AI can\'t handle, our support team is standing by.' },
] as const

// ─── Stats ───────────────────────────────────────────────────────────────────
const STATS = [
  { value: '4', label: 'Service Verticals', sublabel: 'Live on V1' },
  { value: '10%', label: 'Platform Fee', sublabel: 'No hidden charges' },
  { value: '100%', label: 'Payment Protection', sublabel: 'Every transaction' },
  { value: '24/7', label: 'Resolution Engine', sublabel: 'Always on' },
] as const

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How does REZZO work?',
    a: 'Tell REZZO what you need in plain language. Our AI creates a case, matches you with verified Nigerian professionals, and manages the entire process — from quote to completion and payment release.',
  },
  {
    q: 'How are professionals verified?',
    a: 'Every professional undergoes government ID verification, skills assessment, address confirmation, and reference checks. Only verified professionals can accept cases on the platform.',
  },
  {
    q: 'Is my payment secure?',
    a: 'Absolutely. Payments are held in escrow until you confirm the work meets your expectations. Funds are only released to the professional after your approval and proof of completion.',
  },
  {
    q: "What if I'm not satisfied?",
    a: 'REZZO has a built-in dispute resolution system. Raise a dispute at any point and our team will mediate fairly between you and the professional.',
  },
  {
    q: 'Can I track my case without an account?',
    a: 'Yes. Use the Guest Portal with your case number and registered phone number. However, a full account unlocks messaging, payments, and your document vault.',
  },
  {
    q: 'How much does REZZO cost?',
    a: 'REZZO charges a transparent 10% platform commission on the service fee. No hidden charges. You see the full cost breakdown before accepting any quote.',
  },
] as const

// ─── Testimonials ────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: 'Chidinma O.',
    location: 'Lagos',
    text: 'My AC broke down on a Saturday night. By Sunday morning, REZZO had a verified technician at my door. Problem solved, payment released only after I confirmed. This is how it should work.',
    service: 'Home & Technical',
  },
  {
    name: 'Emeka N.',
    location: 'Abuja',
    text: 'I needed my CAC registration done but kept getting the runaround. REZZO matched me with someone who handled everything in 5 days. The proof was submitted and verified before I paid a kobo.',
    service: 'Business & Enterprise',
  },
  {
    name: 'Amina B.',
    location: 'Kano',
    text: 'My landlord refused to fix the plumbing. I opened a case on REZZO, got a mediation professional, and the issue was resolved within the week. Transparent and fair.',
    service: 'Property & Housing',
  },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
//  HOMEPAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function Homepage() {
  const [showPortal, setShowPortal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questionVisible, setQuestionVisible] = useState(true)

  // Rotate hero questions
  useEffect(() => {
    const interval = setInterval(() => {
      setQuestionVisible(false)
      setTimeout(() => {
        setQuestionIndex((prev) => (prev + 1) % HERO_QUESTIONS.length)
        setQuestionVisible(true)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Navigation ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-[#D9E2EC]/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl rezzo-gradient flex items-center justify-center shadow-lg shadow-[#102A43]/20">
              <span className="text-white font-bold text-lg tracking-tight">R</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[#102A43] text-[22px] tracking-tight leading-none">REZZO</span>
              <span className="hidden sm:block text-[9px] font-semibold text-[#1F7A5A] tracking-[0.2em] uppercase">Resolution Engine</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {[
              { label: 'How It Works', id: 'how-it-works' },
              { label: 'Services', id: 'verticals' },
              { label: 'Why REZZO', id: 'trust' },
              { label: 'FAQ', id: 'faq' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-4 py-2 text-[13px] font-medium text-[#52606D] hover:text-[#102A43] transition-colors rounded-lg hover:bg-[#102A43]/[0.04]"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              className="hidden sm:flex text-[13px] font-medium text-[#52606D] hover:text-[#102A43] hover:bg-[#102A43]/[0.04]"
              onClick={() => setShowPortal(true)}
            >
              <Search className="size-3.5 mr-1.5" />
              Track Case
            </Button>
            <LoginDialog>
              <Button className="h-10 px-5 rounded-xl bg-[#102A43] hover:bg-[#071A2B] text-white text-[13px] font-semibold shadow-lg shadow-[#102A43]/15 transition-all hover:shadow-xl hover:shadow-[#102A43]/25">
                Get Started
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </LoginDialog>
            <button
              className="md:hidden p-2.5 rounded-xl hover:bg-[#102A43]/[0.04] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="size-5 text-[#102A43]" /> : <Menu className="size-5 text-[#102A43]" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#D9E2EC]/60 px-5 py-3 flex flex-col gap-0.5 animate-in slide-in-from-top-2 duration-200">
            {[
              { label: 'How It Works', id: 'how-it-works' },
              { label: 'Services', id: 'verticals' },
              { label: 'Why REZZO', id: 'trust' },
              { label: 'FAQ', id: 'faq' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="px-3 py-3 text-sm text-left text-[#52606D] hover:text-[#102A43] rounded-xl hover:bg-[#102A43]/[0.04] transition-colors"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); setShowPortal(true) }}
              className="px-3 py-3 text-sm text-left text-[#52606D] hover:text-[#102A43] rounded-xl hover:bg-[#102A43]/[0.04] transition-colors"
            >
              Track a Case
            </button>
          </div>
        )}
      </nav>

      {/* ─── Hero Section ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-10%] right-[-5%] w-[700px] h-[700px] bg-[#1F7A5A]/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-[#102A43]/[0.04] rounded-full blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-[#E0A23A]/[0.03] rounded-full blur-[80px]" />
        </div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-20 sm:pt-32 pb-20 sm:pb-28">
          <div className="max-w-3xl mx-auto text-center flex flex-col gap-7">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 self-center bg-white border border-[#D9E2EC]/80 rounded-full px-5 py-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1F7A5A] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1F7A5A]"></span>
              </span>
              <span className="text-[11px] font-semibold text-[#52606D] tracking-wide">NOW LIVE IN NIGERIA</span>
            </div>

            {/* Rotating Question */}
            <div className="min-h-[80px] sm:min-h-[96px] flex items-center justify-center">
              <h1
                className={`text-[42px] sm:text-[56px] lg:text-[68px] font-bold text-[#102A43] leading-[1.05] tracking-tight transition-all duration-400 ${
                  questionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                {HERO_QUESTIONS[questionIndex]}
              </h1>
            </div>

            {/* Tagline */}
            <p className="text-xl sm:text-2xl font-medium text-[#1F7A5A] leading-snug">
              We can help you <span className="relative">
                rezolve
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 100 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 5.5C15 2 35 1 50 3C65 5 85 3 99 1.5" stroke="#2ECC8B" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
                </svg>
              </span> them.
            </p>

            <p className="text-[15px] sm:text-base text-[#52606D] leading-relaxed max-w-xl mx-auto">
              Tell REZZO what you need. Our AI matches you with verified Nigerian professionals 
              who get the job done — with guaranteed quality, transparent pricing, and payment protection on every case.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-1">
              <LoginDialog>
                <Button size="lg" className="h-[54px] px-9 rounded-2xl bg-[#102A43] hover:bg-[#071A2B] text-white font-semibold text-[15px] gap-2.5 shadow-xl shadow-[#102A43]/20 transition-all hover:shadow-2xl hover:shadow-[#102A43]/30 hover:scale-[1.02]">
                  Start a Case
                  <ArrowRight className="size-4" />
                </Button>
              </LoginDialog>
              <Button
                size="lg"
                variant="outline"
                className="h-[54px] px-9 rounded-2xl border-[#D9E2EC] text-[#102A43] font-semibold text-[15px] gap-2.5 hover:bg-[#102A43]/[0.03] hover:border-[#102A43]/30 transition-all"
                onClick={() => setShowPortal(true)}
              >
                <Search className="size-4" />
                Track Existing Case
              </Button>
            </div>

            <div className="flex items-center justify-center gap-4 mt-2">
              {['No upfront payment', 'Free to create cases', 'Pay only on acceptance'].map((item) => (
                <span key={item} className="hidden sm:flex items-center gap-1.5 text-[12px] text-[#52606D]/70">
                  <CheckCircle2 className="size-3 text-[#1F7A5A]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#D9E2EC]/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {STATS.map((stat, i) => (
              <div key={stat.label} className={`text-center ${i < STATS.length - 1 ? 'lg:border-r lg:border-[#D9E2EC]/60' : ''}`}>
                <p className="text-4xl sm:text-5xl font-bold text-[#102A43] tracking-tight">{stat.value}</p>
                <p className="text-sm font-semibold text-[#102A43] mt-2">{stat.label}</p>
                <p className="text-xs text-[#52606D]/70 mt-0.5">{stat.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-[#1F7A5A] uppercase tracking-[0.2em] mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#102A43] tracking-tight">From problem to resolution</h2>
            <p className="text-[15px] text-[#52606D] mt-4 max-w-lg mx-auto leading-relaxed">
              Our AI-powered resolution engine handles the complexity. You just describe the problem.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-[60px] left-[12%] right-[12%] h-px bg-gradient-to-r from-[#102A43]/10 via-[#1F7A5A]/20 to-[#102A43]/10" />

            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.num} className="relative group">
                  <Card className="relative p-7 rounded-2xl border-[#D9E2EC]/60 bg-white hover:border-[#1F7A5A]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#102A43]/[0.06] hover:-translate-y-1 h-full">
                    <span className="text-[56px] font-black text-[#102A43]/[0.04] absolute top-3 right-5 select-none leading-none">{step.num}</span>
                    <div className="w-14 h-14 rounded-2xl bg-[#102A43] flex items-center justify-center mb-5 group-hover:bg-[#1F7A5A] transition-colors duration-300">
                      <Icon className="size-6 text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-[#1F7A5A] uppercase tracking-[0.15em] mb-1.5">{step.subtitle}</p>
                    <h3 className="text-[17px] font-bold text-[#102A43] mb-2.5">{step.title}</h3>
                    <p className="text-[13px] text-[#52606D] leading-[1.7]">{step.desc}</p>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Verticals / Services ─────────────────────────────────── */}
      <section id="verticals" className="bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-[#1F7A5A] uppercase tracking-[0.2em] mb-3">Services</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#102A43] tracking-tight">One platform, every resolution</h2>
            <p className="text-[15px] text-[#52606D] mt-4 max-w-lg mx-auto leading-relaxed">
              Four verticals covering the most pressing everyday needs of Nigerians. More coming soon.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {VERTICALS.map((v) => {
              const Icon = v.icon
              return (
                <Card key={v.title} className={`p-0 rounded-2xl border-[#D9E2EC]/60 bg-white overflow-hidden hover:shadow-xl hover:shadow-[#102A43]/[0.06] transition-all duration-300 hover:-translate-y-0.5 group border-l-4 ${v.borderAccent}`}>
                  <div className="p-6 sm:p-7">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${v.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`size-5.5 ${v.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[17px] font-bold text-[#102A43] mb-1.5">{v.title}</h3>
                        <p className="text-[13px] text-[#52606D] leading-[1.7] mb-4">{v.desc}</p>
                        <div className="flex flex-wrap gap-2">
                          {v.examples.map((ex) => (
                            <span key={ex} className="text-[11px] font-medium bg-[#F0F4F8] px-3 py-1.5 rounded-full text-[#52606D]">
                              {ex}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────── */}
      <section>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-[#1F7A5A] uppercase tracking-[0.2em] mb-3">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#102A43] tracking-tight">Trusted by Nigerians</h2>
            <p className="text-[15px] text-[#52606D] mt-4 max-w-lg mx-auto leading-relaxed">
              Real resolutions from real people. No gimmicks.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} className="p-7 rounded-2xl border-[#D9E2EC]/60 bg-white hover:shadow-lg hover:shadow-[#102A43]/[0.04] transition-all duration-300 flex flex-col">
                {/* Stars */}
                <div className="flex items-center gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-[#E0A23A]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[13px] text-[#52606D] leading-[1.8] flex-1 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-5 pt-5 border-t border-[#D9E2EC]/60 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-bold text-[#102A43]">{t.name}</p>
                    <p className="text-[11px] text-[#52606D]/70">{t.location}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#1F7A5A] bg-[#1F7A5A]/10 px-2.5 py-1 rounded-full">{t.service}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust Section ────────────────────────────────────────── */}
      <section id="trust" className="bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-[#1F7A5A] uppercase tracking-[0.2em] mb-3">Why REZZO</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#102A43] tracking-tight">Built for trust, designed for Nigeria</h2>
            <p className="text-[15px] text-[#52606D] mt-4 max-w-lg mx-auto leading-relaxed">
              Every feature is engineered around accountability, transparency, and the realities of the Nigerian service market.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="p-7 rounded-2xl border-[#D9E2EC]/60 bg-white hover:shadow-lg hover:shadow-[#102A43]/[0.04] transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1F7A5A]/10 flex items-center justify-center shrink-0">
                      <Icon className="size-5.5 text-[#1F7A5A]" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#102A43] mb-2">{item.title}</h3>
                      <p className="text-[13px] text-[#52606D] leading-[1.7]">{item.desc}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Professional CTA ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 rezzo-gradient" />
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#1F7A5A]/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-[#E0A23A]/10 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-24 sm:py-32 relative z-10">
          <div className="max-w-2xl mx-auto text-center flex flex-col gap-6">
            <div className="inline-flex items-center gap-2.5 self-center bg-white/10 border border-white/10 rounded-full px-5 py-2">
              <Wrench className="size-3.5 text-[#E0A23A]" />
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-[0.15em]">For Professionals</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
              Grow your business on REZZO
            </h2>
            <p className="text-[15px] text-white/60 leading-[1.8] max-w-lg mx-auto">
              Join verified Nigerian professionals earning on Nigeria&apos;s first AI-powered resolution platform. 
              Get matched with real customers, receive guaranteed payments, and build your reputation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-2">
              <LoginDialog defaultRole="PROFESSIONAL">
                <Button size="lg" className="h-[52px] px-8 rounded-2xl bg-[#E0A23A] hover:bg-[#C98D2E] text-[#102A43] font-bold text-[14px] gap-2.5 shadow-xl shadow-black/20 transition-all hover:shadow-2xl hover:scale-[1.02]">
                  Apply as a Professional
                  <ArrowRight className="size-4" />
                </Button>
              </LoginDialog>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ Section ──────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-[#1F7A5A] uppercase tracking-[0.2em] mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#102A43] tracking-tight">Frequently asked questions</h2>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((faq, i) => (
              <Card key={i} className="rounded-2xl border-[#D9E2EC]/60 overflow-hidden bg-white hover:border-[#1F7A5A]/20 transition-colors">
                <button
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-[14px] font-semibold text-[#102A43] pr-4">{faq.q}</span>
                  <ChevronDown className={`size-4 text-[#52606D] shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 -mt-1">
                    <p className="text-[13px] text-[#52606D] leading-[1.8]">{faq.a}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Guest Portal CTA Banner ──────────────────────────────── */}
      <section className="bg-white border-t border-[#D9E2EC]/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14">
          <Card className="p-8 sm:p-10 rounded-2xl border-[#1F7A5A]/20 bg-gradient-to-br from-[#1F7A5A]/[0.03] to-[#1F7A5A]/[0.01]">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#1F7A5A]/10 flex items-center justify-center shrink-0">
                <Eye className="size-8 text-[#1F7A5A]" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl font-bold text-[#102A43]">Have an existing case?</h3>
                <p className="text-[14px] text-[#52606D] mt-1.5 leading-relaxed">
                  Track your case status, view updates, and communicate with your assigned professional — no login required.
                </p>
              </div>
              <Button
                className="h-12 px-7 rounded-2xl bg-[#1F7A5A] hover:bg-[#1A6B4E] text-white font-semibold text-[14px] gap-2.5 shrink-0 shadow-lg shadow-[#1F7A5A]/20 transition-all hover:shadow-xl hover:shadow-[#1F7A5A]/30"
                onClick={() => setShowPortal(true)}
              >
                Open Guest Portal
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-[#071A2B]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <span className="font-bold text-white text-[22px] tracking-tight">REZZO</span>
              </div>
              <p className="text-[13px] text-white/40 leading-[1.8] max-w-[260px]">
                Nigeria&apos;s AI-powered resolution platform. From need statement to verified resolution.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-[12px] font-bold text-white/70 uppercase tracking-[0.15em] mb-5">Platform</h4>
              <ul className="flex flex-col gap-3">
                {['How It Works', 'Services', 'Pricing', 'For Professionals'].map((l) => (
                  <li key={l}>
                    <button className="text-[13px] text-white/40 hover:text-white/80 transition-colors">
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-white/70 uppercase tracking-[0.15em] mb-5">Support</h4>
              <ul className="flex flex-col gap-3">
                {['Help Center', 'Guest Portal', 'Contact Us', 'Report an Issue'].map((l) => (
                  <li key={l}>
                    <button
                      className="text-[13px] text-white/40 hover:text-white/80 transition-colors"
                      onClick={l === 'Guest Portal' ? () => setShowPortal(true) : undefined}
                    >
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-white/70 uppercase tracking-[0.15em] mb-5">Legal</h4>
              <ul className="flex flex-col gap-3">
                {['Terms of Service', 'Privacy Policy', 'Cookie Policy'].map((l) => (
                  <li key={l}>
                    <button className="text-[13px] text-white/40 hover:text-white/80 transition-colors">
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-white/30">&copy; {new Date().getFullYear()} REZZO. All rights reserved. Made in Nigeria.</p>
            <div className="flex items-center gap-6">
              {['Twitter', 'Instagram', 'LinkedIn'].map((s) => (
                <button key={s} className="text-[12px] text-white/30 hover:text-white/60 transition-colors font-medium">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Guest Portal Modal ───────────────────────────────────── */}
      {showPortal && <GuestPortal onClose={() => setShowPortal(false)} />}
    </div>
  )
}

// Shared password for the seeded demo accounts (see prisma/seed.ts). This is
// a local/pilot sandbox convenience, not a secret credential for real users.
const DEMO_ACCOUNT_PASSWORD = 'Rezzo@Demo123'
const MIN_REGISTER_PASSWORD_LENGTH = 8

// ─── Login Dialog (Inline) ───────────────────────────────────────────────────
function LoginDialog({
  children,
  defaultRole = 'CUSTOMER'
}: {
  children: React.ReactNode
  defaultRole?: 'CUSTOMER' | 'PROFESSIONAL'
}) {
  const setCurrentUser = useRezzoStore((s) => s.setCurrentUser)
  const setAuthToken = useRezzoStore((s) => s.setAuthToken)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'CUSTOMER' | 'PROFESSIONAL'>(defaultRole)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number')
      return
    }
    if (!password) {
      setError('Please enter your password')
      return
    }
    if (mode === 'register' && password.length < MIN_REGISTER_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_REGISTER_PASSWORD_LENGTH} characters`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      try {
        const res = await apiPost<{ user?: { id: string; displayName?: string; name?: string; phone: string; role: string; professionalId?: string | null; verificationStatus?: string | null }; token?: string }>(
          '/auth/login',
          { phone: phone.trim(), password }
        )
        if (res.user) {
          if (res.token) setAuthToken(res.token)
          setCurrentUser({
            id: res.user.id,
            name: res.user.displayName || res.user.name || 'User',
            phone: res.user.phone,
            role: res.user.role as 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN',
            professionalId: res.user.professionalId,
            verificationStatus: res.user.verificationStatus,
          })
          setOpen(false)
          return
        }
      } catch { /* fall through to register — a first-time visitor with no
                   account yet is the common case this is for */ }
      const regName = name.trim() || (role === 'PROFESSIONAL' ? 'Professional' : 'Customer')
      try {
        const res = await apiPost<{ user: { id: string; displayName?: string; name?: string; phone: string; role: string }; token?: string }>(
          '/auth/register',
          { phone: phone.trim(), password, name: regName, role }
        )
        if (res.token) setAuthToken(res.token)
        setCurrentUser({
          id: res.user.id,
          name: res.user.displayName || res.user.name || regName,
          phone: res.user.phone,
          role,
        })
        setOpen(false)
      } catch (registerErr) {
        // Register failing with CONFLICT right after login already failed
        // for the same phone means this phone has an account — the login
        // attempt above didn't fail for lack of one, it failed because the
        // password was wrong. Surfacing register's own "already exists"
        // text here said nothing about a password and read like an
        // unrelated error to someone who just mistyped theirs.
        if (registerErr instanceof ApiError && registerErr.code === 'CONFLICT') {
          throw new Error('Invalid phone/email or password')
        }
        throw registerErr
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [phone, name, password, mode, role, setCurrentUser])

  const handleDemoLogin = useCallback(async (demoRole: 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN') => {
    setLoading(true)
    setError(null)
    try {
      interface LoginUser { id: string; displayName?: string; name?: string; phone?: string; email?: string; role: string; professionalId?: string | null; verificationStatus?: string | null }

      // The seeded admin account only ever exists via the seed script (public
      // self-registration can no longer create admins) — log in only, with
      // no create-on-demand fallback.
      if (demoRole === 'ADMIN') {
        const res = await apiPost<{ user?: LoginUser; token?: string }>(
          '/auth/login',
          { email: 'admin@rezzo.ng', password: DEMO_ACCOUNT_PASSWORD }
        )
        if (!res.user) throw new Error('Admin demo account is not available')
        if (res.token) setAuthToken(res.token)
        setCurrentUser({
          id: res.user.id,
          name: res.user.displayName || res.user.name || 'REZZO Admin',
          email: res.user.email,
          role: res.user.role as 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN',
          professionalId: res.user.professionalId,
          verificationStatus: res.user.verificationStatus,
        })
        setOpen(false)
        return
      }

      const demoPhones: Record<string, string> = {
        CUSTOMER: '08010000001',
        PROFESSIONAL: '08020000001',
      }
      const demoNames: Record<string, string> = {
        CUSTOMER: 'Adebayo Okonkwo',
        PROFESSIONAL: 'Tunde Adeyemi',
      }
      try {
        const res = await apiPost<{ user?: LoginUser; token?: string }>(
          '/auth/login',
          { phone: demoPhones[demoRole], password: DEMO_ACCOUNT_PASSWORD }
        )
        if (res.user) {
          if (res.token) setAuthToken(res.token)
          setCurrentUser({
            id: res.user.id,
            name: res.user.displayName || res.user.name || demoNames[demoRole],
            phone: res.user.phone,
            email: res.user.email,
            role: res.user.role as 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN',
            professionalId: res.user.professionalId,
            verificationStatus: res.user.verificationStatus,
          })
          setOpen(false)
          return
        }
      } catch { /* fall through — no account under this demo phone yet */ }
      try {
        const regRes = await apiPost<{ user: LoginUser; token?: string }>(
          '/auth/register',
          { phone: demoPhones[demoRole], password: DEMO_ACCOUNT_PASSWORD, name: demoNames[demoRole], role: demoRole }
        )
        const u = regRes.user
        if (regRes.token) setAuthToken(regRes.token)
        setCurrentUser({ id: u.id, name: u.displayName || u.name || demoNames[demoRole], phone: u.phone, email: u.email, role: demoRole })
        setOpen(false)
      } catch (registerErr) {
        // This demo phone exists under a different password than the
        // shared demo one — same reasoning as handleSubmit above.
        if (registerErr instanceof ApiError && registerErr.code === 'CONFLICT') {
          throw new Error('This demo account is unavailable right now')
        }
        throw registerErr
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [setCurrentUser])

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#102A43]/50 backdrop-blur-md" onClick={() => setOpen(false)} />
          {/* Dialog */}
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-[420px] p-7 sm:p-9 animate-in fade-in zoom-in-95 duration-200">
            <button
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-[#F0F4F8] transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="size-5 text-[#52606D]" />
            </button>

            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg rezzo-gradient flex items-center justify-center">
                    <span className="text-white font-bold text-sm">R</span>
                  </div>
                  <h2 className="text-xl font-bold text-[#102A43]">Welcome to REZZO</h2>
                </div>
                <p className="text-[13px] text-[#52606D]">Get started with your phone number and password</p>
              </div>

              {/* Role Toggle */}
              <div className="flex gap-1 bg-[#F0F4F8] p-1 rounded-xl">
                <button
                  onClick={() => setRole('CUSTOMER')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    role === 'CUSTOMER'
                      ? 'bg-white text-[#102A43] shadow-sm'
                      : 'text-[#52606D] hover:text-[#102A43]'
                  }`}
                >
                  <User className="size-3.5" />
                  Customer
                </button>
                <button
                  onClick={() => setRole('PROFESSIONAL')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    role === 'PROFESSIONAL'
                      ? 'bg-white text-[#102A43] shadow-sm'
                      : 'text-[#52606D] hover:text-[#102A43]'
                  }`}
                >
                  <Wrench className="size-3.5" />
                  Professional
                </button>
              </div>

              {/* Form */}
              <div className="flex flex-col gap-3.5">
                {mode === 'register' && (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="h-12 w-full rounded-xl border border-[#D9E2EC] bg-transparent px-4 text-[14px] text-[#102A43] placeholder:text-[#52606D]/50 focus-visible:border-[#1F7A5A] focus-visible:ring-[#1F7A5A]/20 focus-visible:ring-[3px] outline-none transition-all"
                  />
                )}
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone Number (e.g. 08012345678)"
                  className="h-12 w-full rounded-xl border border-[#D9E2EC] bg-transparent px-4 text-[14px] text-[#102A43] placeholder:text-[#52606D]/50 focus-visible:border-[#1F7A5A] focus-visible:ring-[#1F7A5A]/20 focus-visible:ring-[3px] outline-none transition-all"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? `Password (min. ${MIN_REGISTER_PASSWORD_LENGTH} characters)` : 'Password'}
                    className="h-12 w-full rounded-xl border border-[#D9E2EC] bg-transparent pl-4 pr-11 text-[14px] text-[#102A43] placeholder:text-[#52606D]/50 focus-visible:border-[#1F7A5A] focus-visible:ring-[#1F7A5A]/20 focus-visible:ring-[3px] outline-none transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#52606D] hover:text-[#102A43] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Eye className="size-4" />
                  </button>
                </div>

                {error && <p className="text-[12px] text-[#C23B3B] font-medium">{error}</p>}

                <Button
                  className="w-full h-12 rounded-xl bg-[#102A43] hover:bg-[#071A2B] text-white font-semibold text-[14px] shadow-lg shadow-[#102A43]/15 transition-all"
                  disabled={loading}
                  onClick={handleSubmit}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : mode === 'login' ? 'Continue' : 'Create Account'}
                </Button>

                <button
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-[12px] text-[#52606D] hover:text-[#102A43] transition-colors text-center"
                >
                  {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
                </button>

                <p className="text-[10px] text-center text-[#52606D]/50">
                  By continuing, you agree to REZZO&apos;s Terms of Service and Privacy Policy.
                </p>
              </div>

              {/* Demo Access */}
              <div className="border-t border-[#D9E2EC]/60 pt-5">
                <p className="text-[11px] font-semibold text-[#52606D] mb-3 text-center uppercase tracking-[0.1em]">Quick Demo Access</p>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => handleDemoLogin('CUSTOMER')}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#D9E2EC]/80 hover:bg-[#1F7A5A]/[0.03] hover:border-[#1F7A5A]/30 transition-all disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#1F7A5A]/10 flex items-center justify-center">
                      <User className="size-4 text-[#1F7A5A]" />
                    </div>
                    <span className="text-[10px] font-semibold text-[#102A43]">Customer</span>
                  </button>
                  <button
                    onClick={() => handleDemoLogin('PROFESSIONAL')}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#D9E2EC]/80 hover:bg-[#E0A23A]/[0.03] hover:border-[#E0A23A]/30 transition-all disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#E0A23A]/10 flex items-center justify-center">
                      <Wrench className="size-4 text-[#E0A23A]" />
                    </div>
                    <span className="text-[10px] font-semibold text-[#102A43]">Professional</span>
                  </button>
                  <button
                    onClick={() => handleDemoLogin('ADMIN')}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#D9E2EC]/80 hover:bg-[#102A43]/[0.03] hover:border-[#102A43]/30 transition-all disabled:opacity-50"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#102A43]/10 flex items-center justify-center">
                      <Shield className="size-4 text-[#102A43]" />
                    </div>
                    <span className="text-[10px] font-semibold text-[#102A43]">Admin</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}