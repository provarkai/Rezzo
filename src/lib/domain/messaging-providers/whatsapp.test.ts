import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import crypto from 'crypto'
import { verifyWhatsAppSignature, normalizePhone, isWhatsAppConfigured } from './whatsapp'

const TEST_SECRET = 'fake_app_secret_for_unit_tests_only'

function sign(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

describe('normalizePhone', () => {
  it('adds a "+" prefix when missing (Meta sends numbers without one)', () => {
    expect(normalizePhone('2348012345678')).toBe('+2348012345678')
  })

  it('is idempotent when a "+" is already present (matches seed data format)', () => {
    expect(normalizePhone('+2348012345678')).toBe('+2348012345678')
  })

  it('strips non-digit characters (spaces, dashes, parens)', () => {
    expect(normalizePhone('+234 801 234 5678')).toBe('+2348012345678')
    expect(normalizePhone('(234) 801-234-5678')).toBe('+2348012345678')
  })
})

describe('verifyWhatsAppSignature', () => {
  const originalSecret = process.env.WHATSAPP_APP_SECRET

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = TEST_SECRET
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.WHATSAPP_APP_SECRET
    else process.env.WHATSAPP_APP_SECRET = originalSecret
  })

  it('accepts a signature computed the way Meta actually computes it (sha256=<hmac-sha256 hex>)', () => {
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [] } }] }] })
    expect(verifyWhatsAppSignature(body, sign(body, TEST_SECRET))).toBe(true)
  })

  it('rejects a signature missing the "sha256=" prefix', () => {
    const body = '{}'
    const bare = crypto.createHmac('sha256', TEST_SECRET).update(body).digest('hex')
    expect(verifyWhatsAppSignature(body, bare)).toBe(false)
  })

  it('rejects a signature computed with the wrong app secret', () => {
    const body = '{}'
    expect(verifyWhatsAppSignature(body, sign(body, 'wrong-secret'))).toBe(false)
  })

  it('rejects a body that does not match what was signed', () => {
    const signature = sign('{"a":1}', TEST_SECRET)
    expect(verifyWhatsAppSignature('{"a":2}', signature)).toBe(false)
  })

  it('rejects a missing signature header', () => {
    expect(verifyWhatsAppSignature('{}', null)).toBe(false)
  })

  it('rejects (never throws) when WHATSAPP_APP_SECRET is unconfigured', () => {
    delete process.env.WHATSAPP_APP_SECRET
    const body = '{}'
    expect(() => verifyWhatsAppSignature(body, sign(body, TEST_SECRET))).not.toThrow()
    expect(verifyWhatsAppSignature(body, sign(body, TEST_SECRET))).toBe(false)
  })
})

describe('isWhatsAppConfigured', () => {
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN
  const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

  afterAll(() => {
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN
    else process.env.WHATSAPP_ACCESS_TOKEN = originalToken
    if (originalPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID
    else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId
  })

  it('requires both the access token and phone number ID', () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    expect(isWhatsAppConfigured()).toBe(false)

    process.env.WHATSAPP_ACCESS_TOKEN = 'token'
    expect(isWhatsAppConfigured()).toBe(false) // phone number id still missing

    process.env.WHATSAPP_PHONE_NUMBER_ID = 'id'
    expect(isWhatsAppConfigured()).toBe(true)
  })
})
