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
  /** Patches fields on the existing currentUser (e.g. professionalId right
   *  after a successful application) without the fresh-login reset
   *  setCurrentUser does — an application doesn't change who's logged in or
   *  which mode is active, so activeMode must survive it untouched. */
  updateCurrentUser: (patch: Partial<UserState>) => void
  setAuthToken: (token: string | null) => void
  /** True while the professional-application form (ProfessionalApply) was
   *  explicitly opened this session — e.g. from CustomerProfile's "Apply to
   *  become a professional". page.tsx also shows that form automatically
   *  for a role='PROFESSIONAL' account with no Professional record yet
   *  (registered but never finished applying) independent of this flag. */
  professionalApplyOpen: boolean
  setProfessionalApplyOpen: (open: boolean) => void
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
    set({ currentUser: user, activeMode: null, professionalApplyOpen: false })
  },
  updateCurrentUser: (patch) => set((s) => (s.currentUser ? { currentUser: { ...s.currentUser, ...patch } } : {})),
  professionalApplyOpen: false,
  setProfessionalApplyOpen: (open) => set({ professionalApplyOpen: open }),
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
    set({ currentUser: null, authToken: null, activeMode: null, professionalApplyOpen: false, currentView: 'landing' })
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

// Carries the server's error `code` (VALIDATION_ERROR, CONFLICT,
// AUTH_INVALID_CREDENTIALS, ...) alongside the message, so a caller can
// branch on the actual failure reason instead of matching message text.
export class ApiError extends Error {
  code?: string
  status: number
  constructor(message: string, code: string | undefined, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // A 401 only means "your session expired" when this request actually
  // carried a token that got rejected. /auth/login also answers with 401
  // for plain wrong-phone-or-password — on a request that never had a
  // token to begin with, that isn't a session expiring, and treating it
  // as one discarded login's real "Invalid phone/email or password"
  // message in favor of a misleading "Session expired" for every visitor
  // who just mistyped their password.
  const hadToken = !!useRezzoStore.getState().authToken

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string> || {}) },
  })

  const json = await res.json().catch(() => ({}))

  if (res.status === 401 && hadToken) {
    useRezzoStore.getState().logout()
    throw new AuthError('Session expired. Please sign in again.')
  }

  if (!res.ok) {
    throw new ApiError(json.error?.message || 'Request failed', json.error?.code, res.status)
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