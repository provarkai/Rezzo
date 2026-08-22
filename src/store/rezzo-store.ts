import { create } from 'zustand'

export type UserRole = 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN'
export type AppView = 'landing' | 'customer' | 'professional' | 'admin'
export type ActiveMode = 'CUSTOMER' | 'PROFESSIONAL'

interface UserState {
  id: string
  role: UserRole
  name: string
  phone?: string
  email?: string
  /** Present when this account also has a Professional record — independent
   *  of `role`, since applying to become a professional doesn't remove
   *  customer access (see AccountModeChooser / rezzo_active_mode below). */
  professionalId?: string | null
  verificationStatus?: string | null
}

interface RezzoState {
  currentUser: UserState | null
  authToken: string | null
  setCurrentUser: (user: UserState | null) => void
  setAuthToken: (token: string | null) => void
  /** Which side of a dual customer+professional account is currently in
   *  use. Only one is ever active at a time — chosen right after login
   *  (immediately, with no prompt, for accounts that only have one side)
   *  and changed only via an explicit "switch account" action, never a
   *  live in-session toggle. Persisted so a page refresh doesn't bounce a
   *  professional back into the chooser. Null for admins (not applicable)
   *  and for a dual account that hasn't chosen yet. */
  activeMode: ActiveMode | null
  setActiveMode: (mode: ActiveMode | null) => void
  logout: () => void
  currentView: AppView
  setCurrentView: (view: AppView) => void
  customerTab: string
  setCustomerTab: (tab: string) => void
  selectedCaseId: string | null
  setSelectedCaseId: (id: string | null) => void
  professionalTab: string
  setProfessionalTab: (tab: string) => void
  proSelectedCaseId: string | null
  setProSelectedCaseId: (id: string | null) => void
  adminTab: string
  setAdminTab: (tab: string) => void
  adminSelectedCaseId: string | null
  setAdminSelectedCaseId: (id: string | null) => void
}

export const useRezzoStore = create<RezzoState>((set) => ({
  currentUser: null,
  authToken: typeof window !== 'undefined' ? localStorage.getItem('rezzo_token') : null,
  setCurrentUser: (user) => {
    // `currentUser` itself isn't persisted (a refresh always lands back on
    // Homepage and requires signing in again), but `activeMode` is — so
    // without this, a stale mode from a previous account/session on the
    // same browser could leak into a fresh login. Every call here means a
    // fresh identity (or a logout), so always force a fresh mode decision.
    if (typeof window !== 'undefined') localStorage.removeItem('rezzo_active_mode')
    set({ currentUser: user, activeMode: null })
  },
  setAuthToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('rezzo_token', token)
      else localStorage.removeItem('rezzo_token')
    }
    set({ authToken: token })
  },
  activeMode: (typeof window !== 'undefined' ? localStorage.getItem('rezzo_active_mode') : null) as ActiveMode | null,
  setActiveMode: (mode) => {
    if (typeof window !== 'undefined') {
      if (mode) localStorage.setItem('rezzo_active_mode', mode)
      else localStorage.removeItem('rezzo_active_mode')
    }
    set({ activeMode: mode })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rezzo_token')
      localStorage.removeItem('rezzo_active_mode')
    }
    set({ currentUser: null, authToken: null, activeMode: null, currentView: 'landing' })
  },
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),
  customerTab: 'home',
  setCustomerTab: (tab) => set({ customerTab: tab }),
  selectedCaseId: null,
  setSelectedCaseId: (id) => set({ selectedCaseId: id }),
  professionalTab: 'dashboard',
  setProfessionalTab: (tab) => set({ professionalTab: tab }),
  proSelectedCaseId: null,
  setProSelectedCaseId: (id) => set({ proSelectedCaseId: id }),
  adminTab: 'overview',
  setAdminTab: (tab) => set({ adminTab: tab }),
  adminSelectedCaseId: null,
  setAdminSelectedCaseId: (id) => set({ adminSelectedCaseId: id }),
}))

const API_BASE = '/api/v1'

function getHeaders(): Record<string, string> {
  const state = useRezzoStore.getState()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Send signed token as Bearer
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`
  }
  // Keep X-User-Id for backward compatibility during migration
  if (state.currentUser?.id) {
    headers['X-User-Id'] = state.currentUser.id
  }
  return headers
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string> || {}) },
  })

  // Handle 401 — token expired or invalid
  if (res.status === 401) {
    useRezzoStore.getState().logout()
    throw new AuthError('Session expired. Please sign in again.')
  }

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message || 'Request failed')
  }
  return json.data !== undefined ? json.data : json
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' })
}

/**
 * Safely extract an array from an API response that may be
 * `{ items: [...] }` or `[...]` directly.
 */
export function extractList<T>(response: unknown, key?: string): T[] {
  if (Array.isArray(response)) return response as T[]
  if (response && typeof response === 'object' && key) {
    const val = (response as Record<string, unknown>)[key]
    if (Array.isArray(val)) return val as T[]
  }
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>
    for (const k of ['cases', 'professionals', 'items', 'data', 'results', 'records']) {
      if (Array.isArray(obj[k])) return obj[k] as T[]
    }
  }
  return []
}