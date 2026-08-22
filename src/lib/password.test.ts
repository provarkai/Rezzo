import { describe, it, expect } from 'bun:test'
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from './password'

describe('hashPassword', () => {
  it('produces a scrypt:<salt>:<hash> formatted string', () => {
    const hash = hashPassword('correct horse battery staple')
    const parts = hash.split(':')
    expect(parts.length).toBe(3)
    expect(parts[0]).toBe('scrypt')
    expect(parts[1].length).toBe(32) // 16 random salt bytes, hex-encoded
    expect(parts[2].length).toBe(128) // 64-byte derived key, hex-encoded
  })

  it('salts each hash independently, so the same password never repeats', () => {
    const a = hashPassword('same-password')
    const b = hashPassword('same-password')
    expect(a).not.toBe(b)
  })
})

describe('verifyPassword', () => {
  it('accepts the correct password against its own hash', () => {
    const hash = hashPassword('Rezzo@Demo123')
    expect(verifyPassword('Rezzo@Demo123', hash)).toBe(true)
  })

  it('rejects an incorrect password', () => {
    const hash = hashPassword('Rezzo@Demo123')
    expect(verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('rejects an empty password attempt against a real hash', () => {
    const hash = hashPassword('something')
    expect(verifyPassword('', hash)).toBe(false)
  })

  it('never throws on a missing stored hash', () => {
    expect(verifyPassword('anything', null)).toBe(false)
    expect(verifyPassword('anything', undefined)).toBe(false)
    expect(verifyPassword('anything', '')).toBe(false)
  })

  it('never throws on a malformed stored hash', () => {
    expect(verifyPassword('anything', 'not-a-real-hash')).toBe(false)
    expect(verifyPassword('anything', 'bcrypt:salt:hash')).toBe(false) // wrong scheme
    expect(verifyPassword('anything', 'scrypt:onlyonepart')).toBe(false) // missing a segment
    expect(verifyPassword('anything', 'scrypt:salt:hash:extra')).toBe(false) // too many segments
  })
})

describe('MIN_PASSWORD_LENGTH', () => {
  it('matches the documented minimum (registration/login enforce this)', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
  })
})
