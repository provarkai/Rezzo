import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import crypto from 'crypto'
import { verifyPaystackSignature, isPaystackConfigured } from './paystack'

const TEST_KEY = 'sk_test_fake_key_for_unit_tests_only'

function sign(body: string, key: string): string {
  return crypto.createHmac('sha512', key).update(body).digest('hex')
}

describe('verifyPaystackSignature', () => {
  const originalKey = process.env.PAYSTACK_SECRET_KEY

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = TEST_KEY
  })

  afterAll(() => {
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY
    else process.env.PAYSTACK_SECRET_KEY = originalKey
  })

  it('accepts a signature computed the way Paystack actually computes it (HMAC-SHA512 of the raw body)', () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'abc123', amount: 500000 } })
    const signature = sign(body, TEST_KEY)
    expect(verifyPaystackSignature(body, signature)).toBe(true)
  })

  it('rejects a signature computed over different bytes (e.g. a re-serialized copy of the body)', () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'abc123' } })
    // Same logical content, different byte string (key order/whitespace) —
    // this is exactly the re-serialization trap the webhook route's
    // comment warns about.
    const reSerialized = JSON.stringify({ data: { reference: 'abc123' }, event: 'charge.success' })
    const signature = sign(reSerialized, TEST_KEY)
    expect(verifyPaystackSignature(body, signature)).toBe(false)
  })

  it('rejects a signature computed with the wrong secret key', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    const signature = sign(body, 'a-completely-different-key')
    expect(verifyPaystackSignature(body, signature)).toBe(false)
  })

  it('rejects a missing signature header', () => {
    expect(verifyPaystackSignature('{}', null)).toBe(false)
  })

  it('rejects (never throws) when PAYSTACK_SECRET_KEY is unconfigured', () => {
    delete process.env.PAYSTACK_SECRET_KEY
    const body = '{}'
    const signature = sign(body, TEST_KEY) // attacker-supplied, key unknown either way
    expect(() => verifyPaystackSignature(body, signature)).not.toThrow()
    expect(verifyPaystackSignature(body, signature)).toBe(false)
  })
})

describe('isPaystackConfigured', () => {
  const originalKey = process.env.PAYSTACK_SECRET_KEY
  afterAll(() => {
    if (originalKey === undefined) delete process.env.PAYSTACK_SECRET_KEY
    else process.env.PAYSTACK_SECRET_KEY = originalKey
  })

  it('is false when unset and true when set', () => {
    delete process.env.PAYSTACK_SECRET_KEY
    expect(isPaystackConfigured()).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = TEST_KEY
    expect(isPaystackConfigured()).toBe(true)
  })
})
