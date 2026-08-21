// ============================================================
// REZZO Password Hashing — scrypt (Node crypto, no external deps)
// ============================================================

import crypto from 'crypto'

const SCRYPT_KEYLEN = 64
const MIN_PASSWORD_LENGTH = 8

/**
 * Hash a plaintext password for storage.
 * Format: scrypt:<saltHex>:<hashHex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN)
  return `scrypt:${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verify a plaintext password against a stored hash.
 * Returns false (never throws) for any malformed/missing input.
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!password || !stored) return false
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hashHex] = parts
  try {
    const hashBuffer = Buffer.from(hashHex, 'hex')
    const derivedKey = crypto.scryptSync(password, salt, hashBuffer.length)
    return crypto.timingSafeEqual(hashBuffer, derivedKey)
  } catch {
    return false
  }
}

export { MIN_PASSWORD_LENGTH }
