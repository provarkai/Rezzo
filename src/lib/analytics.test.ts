import { describe, it, expect, afterEach } from 'bun:test'
import { trackEvent, isPostHogConfigured } from './analytics'

describe('isPostHogConfigured', () => {
  const original = process.env.POSTHOG_API_KEY
  afterEach(() => {
    if (original === undefined) delete process.env.POSTHOG_API_KEY
    else process.env.POSTHOG_API_KEY = original
  })

  it('is false when unset, true when set', () => {
    delete process.env.POSTHOG_API_KEY
    expect(isPostHogConfigured()).toBe(false)
    process.env.POSTHOG_API_KEY = 'phc_test'
    expect(isPostHogConfigured()).toBe(true)
  })
})

describe('trackEvent', () => {
  const originalKey = process.env.POSTHOG_API_KEY
  const originalFetch = global.fetch

  afterEach(() => {
    if (originalKey === undefined) delete process.env.POSTHOG_API_KEY
    else process.env.POSTHOG_API_KEY = originalKey
    global.fetch = originalFetch
  })

  it('never throws when PostHog is unconfigured, and does not attempt a network call', async () => {
    delete process.env.POSTHOG_API_KEY
    let fetchCalled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = (async () => { fetchCalled = true; return new Response('{}') }) as any

    await expect(trackEvent({ event: 'need_created', distinctId: 'user_1' })).resolves.toBeUndefined()
    expect(fetchCalled).toBe(false)
  })

  it('forwards to PostHog\'s capture API with the right shape when configured', async () => {
    process.env.POSTHOG_API_KEY = 'phc_test_key'
    let capturedUrl: string | undefined
    let capturedBody: Record<string, unknown> | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = (async (url: string, init: any) => {
      capturedUrl = url
      capturedBody = JSON.parse(init.body)
      return new Response('{}')
    }) as any

    await trackEvent({ event: 'payment_confirmed', distinctId: 'user_1', properties: { amount: 5000 } })

    expect(capturedUrl).toContain('/capture/')
    expect(capturedBody?.api_key).toBe('phc_test_key')
    expect(capturedBody?.event).toBe('payment_confirmed')
    expect(capturedBody?.distinct_id).toBe('user_1')
    expect((capturedBody?.properties as Record<string, unknown>)?.amount).toBe(5000)
  })

  it('never throws even if the PostHog forward itself fails', async () => {
    process.env.POSTHOG_API_KEY = 'phc_test_key'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = (async () => { throw new Error('network down') }) as any

    await expect(trackEvent({ event: 'case_resolved', distinctId: 'user_1' })).resolves.toBeUndefined()
  })
})
