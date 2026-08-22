import { describe, it, expect } from 'bun:test'
import { logger } from './logger'

// Capture what the logger actually writes rather than asserting on
// console call counts — the whole point of a structured logger is the
// shape of the line it produces.
function captureConsole(method: 'log' | 'warn' | 'error', fn: () => void): unknown {
  const original = console[method]
  let captured: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(console as any)[method] = (line: string) => {
    captured = line
  }
  try {
    fn()
  } finally {
    console[method] = original
  }
  return captured ? JSON.parse(captured) : undefined
}

describe('logger', () => {
  it('writes info as a JSON line with timestamp/level/message', () => {
    const parsed = captureConsole('log', () => logger.info('something happened')) as Record<string, unknown>
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('something happened')
    expect(typeof parsed.timestamp).toBe('string')
    expect(new Date(parsed.timestamp as string).toString()).not.toBe('Invalid Date')
  })

  it('routes warn to console.warn and error to console.error, not console.log', () => {
    const warnLine = captureConsole('warn', () => logger.warn('careful')) as Record<string, unknown>
    expect(warnLine.level).toBe('warn')

    const errorLine = captureConsole('error', () => logger.error('broken')) as Record<string, unknown>
    expect(errorLine.level).toBe('error')
  })

  it('merges arbitrary context fields into the line', () => {
    const parsed = captureConsole('log', () =>
      logger.info('payment confirmed', { paymentId: 'pay_123', amount: 5000 })
    ) as Record<string, unknown>
    expect(parsed.paymentId).toBe('pay_123')
    expect(parsed.amount).toBe(5000)
  })

  it('serializes an Error in context to {name, message, stack} instead of "{}"', () => {
    const err = new Error('boom')
    const parsed = captureConsole('error', () => logger.error('it broke', { error: err })) as Record<string, unknown>
    const serialized = parsed.error as Record<string, unknown>
    expect(serialized.message).toBe('boom')
    expect(serialized.name).toBe('Error')
    expect(typeof serialized.stack).toBe('string')
  })
})
