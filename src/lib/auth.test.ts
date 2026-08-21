import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import crypto from 'crypto'
import { signToken, verifyToken, extractBearerToken } from './auth'

describe('signToken / verifyToken', () => {
  const originalSecret = process.env.REZZO_TOKEN_SECRET

  beforeEach(() => {
    process.env.REZZO_TOKEN_SECRET = 'test-secret-do-not-use-in-prod'
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.REZZO_TOKEN_SECRET
    else process.env.REZZO_TOKEN_SECRET = originalSecret
  })

  it('round-trips a signed token', () => {
    const token = signToken({ userId: 'user_123', role: 'CUSTOMER' })
    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.userId).toBe('user_123')
    expect(payload?.role).toBe('CUSTOMER')
  })

  it('sets a 7-day expiry window', () => {
    const token = signToken({ userId: 'user_123', role: 'CUSTOMER' })
    const payload = verifyToken(token)!
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('rejects a token verified against a different secret than it was signed with', () => {
    const token = signToken({ userId: 'user_123', role: 'CUSTOMER' })
    process.env.REZZO_TOKEN_SECRET = 'a-different-secret'
    expect(verifyToken(token)).toBeNull()
  })

  it('rejects a payload tampered with after signing (e.g. swapped role)', () => {
    const token = signToken({ userId: 'user_123', role: 'CUSTOMER' })
    const [, signature] = token.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: 'user_123', role: 'ADMIN', iat: Date.now(), exp: Date.now() + 60_000 })
    ).toString('base64url')
    expect(verifyToken(`${forgedPayload}.${signature}`)).toBeNull()
  })

  it('rejects malformed tokens without throwing', () => {
    expect(verifyToken('not-a-token')).toBeNull()
    expect(verifyToken('')).toBeNull()
    expect(verifyToken('only-one-part')).toBeNull()
  })

  it('rejects an expired token', () => {
    const secret = process.env.REZZO_TOKEN_SECRET as string
    const expiredPayload = {
      userId: 'user_123',
      role: 'CUSTOMER',
      iat: Date.now() - 10_000,
      exp: Date.now() - 1, // already expired
    }
    const payloadStr = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url')
    expect(verifyToken(`${payloadStr}.${signature}`)).toBeNull()
  })

  it('throws rather than silently signing when REZZO_TOKEN_SECRET is unset', () => {
    delete process.env.REZZO_TOKEN_SECRET
    expect(() => signToken({ userId: 'x', role: 'CUSTOMER' })).toThrow()
  })
})

describe('extractBearerToken', () => {
  it('extracts the token from a "Bearer <token>" header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123')
  })

  it('accepts a long bare token with no Bearer prefix', () => {
    const longToken = 'a'.repeat(25)
    expect(extractBearerToken(longToken)).toBe(longToken)
  })

  it('rejects a short bare value (ambiguous, not a plausible token)', () => {
    expect(extractBearerToken('short')).toBeNull()
  })

  it('returns null for a missing header', () => {
    expect(extractBearerToken(null)).toBeNull()
  })
})
