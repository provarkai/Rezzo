// ============================================================
// REZZO Auth — Token signing & verification (HMAC-SHA256)
// No external dependencies. Uses Node.js crypto.
// ============================================================

import crypto from 'crypto'

const TOKEN_SECRET = process.env.REZZO_TOKEN_SECRET || 'rezzo_v1_secret_key_change_in_production'
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface TokenPayload {
  userId: string
  role: string
  iat: number
  exp: number
}

/**
 * Create a signed token string from a payload.
 * Format: base64(payload).base64(signature)
 */
export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const now = Date.now()
  const full: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_MS,
  }
  const payloadStr = Buffer.from(JSON.stringify(full)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadStr)
    .digest('base64url')
  return `${payloadStr}.${signature}`
}

/**
 * Verify a token and return its payload, or null if invalid/expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const [payloadB64, signatureB64] = token.split('.')
    if (!payloadB64 || !signatureB64) return null

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(payloadB64)
      .digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))) {
      return null
    }

    // Decode and check expiry
    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    )
    if (Date.now() > payload.exp) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Extract token from an Authorization header.
 * Accepts: "Bearer <token>" or just "<token>"
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const parts = authHeader.trim().split(' ')
  // "Bearer xxx" or just "xxx"
  if (parts.length === 2 && parts[0] === 'Bearer') return parts[1]
  if (parts.length === 1 && parts[0].length > 20) return parts[0]
  return null
}
