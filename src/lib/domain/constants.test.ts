import { describe, it, expect } from 'bun:test'
import {
  isValidTransition,
  generateCaseNumber,
  formatNaira,
  successResponse,
  errorResponse,
  CASE_STATES,
  COMMISSION_RATE,
  MATCHING_WEIGHTS,
  VERIFICATION_TIER_BONUS,
  CASE_NUMBER_PREFIX,
  CASE_NUMBER_START,
  ACTIVE_VERIFICATION_STATUSES,
  isVerificationActive,
  SERVICE_CATEGORIES,
  VERTICALS,
} from './constants'

describe('isValidTransition (case state machine)', () => {
  it('allows every transition explicitly listed in CASE_STATE_TRANSITIONS', () => {
    // The core happy path, PRD §5.3.
    expect(isValidTransition('NEW', 'UNDERSTANDING')).toBe(true)
    expect(isValidTransition('UNDERSTANDING', 'CONFIRMATION')).toBe(true)
    expect(isValidTransition('CONFIRMATION', 'ROUTED')).toBe(true)
    expect(isValidTransition('ROUTED', 'MATCHING')).toBe(true)
    expect(isValidTransition('MATCHING', 'QUOTE')).toBe(true)
    expect(isValidTransition('QUOTE', 'ACCEPTED')).toBe(true)
    expect(isValidTransition('ACCEPTED', 'PAYMENT')).toBe(true)
    expect(isValidTransition('PAYMENT', 'FUNDED')).toBe(true)
    expect(isValidTransition('FUNDED', 'IN_PROGRESS')).toBe(true)
    expect(isValidTransition('IN_PROGRESS', 'PROOF')).toBe(true)
    expect(isValidTransition('PROOF', 'CUSTOMER_REVIEW')).toBe(true)
    expect(isValidTransition('CUSTOMER_REVIEW', 'COMPLETED')).toBe(true)
    expect(isValidTransition('COMPLETED', 'RESOLVED')).toBe(true)
  })

  it('rejects skipping states out of order', () => {
    expect(isValidTransition('NEW', 'FUNDED')).toBe(false)
    expect(isValidTransition('FUNDED', 'RESOLVED')).toBe(false)
    // The bug fixed in the booking-flow work: FUNDED can't jump straight
    // to PROOF, it has to pass through IN_PROGRESS first.
    expect(isValidTransition('FUNDED', 'PROOF')).toBe(false)
  })

  it('rejects moving backward through the happy path', () => {
    expect(isValidTransition('QUOTE', 'MATCHING')).toBe(false)
    expect(isValidTransition('FUNDED', 'PAYMENT')).toBe(false)
  })

  it('allows the wildcard transitions (dispute/escalate/cancel) from any state', () => {
    expect(isValidTransition('IN_PROGRESS', 'DISPUTED')).toBe(true)
    expect(isValidTransition('QUOTE', 'DISPUTED')).toBe(true)
    expect(isValidTransition('PROOF', 'ESCALATED')).toBe(true)
    expect(isValidTransition('MATCHING', 'CANCELLED')).toBe(true)
  })

  it('allows resolving out of a dispute into REFUNDED, then RESOLVED', () => {
    expect(isValidTransition('DISPUTED', 'REFUNDED')).toBe(true)
    expect(isValidTransition('REFUNDED', 'RESOLVED')).toBe(true)
    // But REFUNDED can't be reached directly from an active state.
    expect(isValidTransition('IN_PROGRESS', 'REFUNDED')).toBe(false)
  })

  it('never allows anything into or out of a state with no listed transition', () => {
    expect(isValidTransition('RESOLVED', 'IN_PROGRESS')).toBe(false)
    expect(isValidTransition('CANCELLED', 'NEW')).toBe(false)
  })
})

describe('generateCaseNumber', () => {
  it('formats as PREFIX-START+count', () => {
    expect(generateCaseNumber(0)).toBe(`${CASE_NUMBER_PREFIX}-${CASE_NUMBER_START}`)
    expect(generateCaseNumber(482)).toBe(`${CASE_NUMBER_PREFIX}-${CASE_NUMBER_START + 482}`)
  })

  it('matches the PRD example format (RZ-10482-style)', () => {
    expect(generateCaseNumber(0)).toMatch(/^RZ-\d+$/)
  })
})

describe('formatNaira', () => {
  it('prefixes with the Naira sign and groups thousands', () => {
    expect(formatNaira(1000)).toBe('₦1,000')
    expect(formatNaira(0)).toBe('₦0')
  })
})

describe('successResponse / errorResponse', () => {
  it('wraps data under `data` with a request_id in meta', () => {
    const res = successResponse({ foo: 'bar' })
    expect(res.data).toEqual({ foo: 'bar' })
    expect(typeof res.meta.request_id).toBe('string')
  })

  it('builds a {code, message} error shape with a default 400 status', () => {
    const err = errorResponse('NOT_FOUND', 'Case not found')
    expect(err).toEqual({ error: { code: 'NOT_FOUND', message: 'Case not found' }, status: 400 })
  })

  it('accepts a custom status', () => {
    const err = errorResponse('FORBIDDEN', 'Nope', 403)
    expect(err.status).toBe(403)
  })
})

describe('MATCHING_WEIGHTS', () => {
  it('sums to 100 (the matching engine scores out of 100 points)', () => {
    const total = Object.values(MATCHING_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })
})

describe('VERIFICATION_TIER_BONUS', () => {
  it('caps out at the VERIFICATION_TIER weight for the top tier', () => {
    expect(VERIFICATION_TIER_BONUS.EXPERT).toBe(MATCHING_WEIGHTS.VERIFICATION_TIER)
  })

  it('gives unverified professionals no matching bonus', () => {
    expect(VERIFICATION_TIER_BONUS.PENDING).toBe(0)
  })
})

describe('COMMISSION_RATE', () => {
  it('is 10%, per the PRD\'s worked example (₦100,000 service -> ₦10,000 commission)', () => {
    expect(COMMISSION_RATE).toBe(0.1)
    expect(100_000 * COMMISSION_RATE).toBe(10_000)
  })
})

describe('isVerificationActive', () => {
  it('is true only for VERIFIED, TRUSTED, and EXPERT', () => {
    expect(isVerificationActive('VERIFIED')).toBe(true)
    expect(isVerificationActive('TRUSTED')).toBe(true)
    expect(isVerificationActive('EXPERT')).toBe(true)
  })

  it('is false for a freshly-applied or otherwise inactive professional', () => {
    // The gap this exists to close: a PENDING professional could submit
    // real quotes before this check was added to the quote-creation route.
    expect(isVerificationActive('PENDING')).toBe(false)
    expect(isVerificationActive('NEEDS_INFO')).toBe(false)
    expect(isVerificationActive('SUSPENDED')).toBe(false)
    expect(isVerificationActive('REVOKED')).toBe(false)
  })

  it('treats missing status as inactive rather than throwing', () => {
    expect(isVerificationActive(null)).toBe(false)
    expect(isVerificationActive(undefined)).toBe(false)
    expect(isVerificationActive('')).toBe(false)
  })

  it('stays in sync with what the matching engine already trusted as "active"', () => {
    expect(ACTIVE_VERIFICATION_STATUSES).toEqual(['VERIFIED', 'TRUSTED', 'EXPERT'])
  })
})

describe('SERVICE_CATEGORIES', () => {
  it('has no duplicate ids', () => {
    const ids = SERVICE_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every category a non-empty label', () => {
    for (const c of SERVICE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0)
    }
  })

  it('only assigns a real VERTICALS value or null, never a made-up one', () => {
    const validVerticals = new Set(Object.values(VERTICALS))
    for (const c of SERVICE_CATEGORIES) {
      expect(c.vertical === null || validVerticals.has(c.vertical)).toBe(true)
    }
  })

  it('matches the known category ids matching-engine.ts and the admin categories route already relied on', () => {
    // Can't import matching-engine.ts here (it pulls in @/lib/db, which
    // doesn't resolve without a generated Prisma client) — this pins the
    // ids that file's CATEGORY_SKILL_MAP hardcodes instead, so a rename
    // here is a deliberate decision, not a silent drift.
    const ids = new Set(SERVICE_CATEGORIES.map((c) => c.id))
    for (const id of ['AC_REPAIR', 'GENERATOR_REPAIR', 'PLUMBING', 'ELECTRICAL', 'PROPERTY_HOUSING', 'BUSINESS_ENTERPRISE', 'GOVERNMENT_DOC', 'GENERAL']) {
      expect(ids.has(id)).toBe(true)
    }
  })
})

describe('CASE_STATES', () => {
  it('has no duplicate values', () => {
    const values = Object.values(CASE_STATES)
    expect(new Set(values).size).toBe(values.length)
  })
})
