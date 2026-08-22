// ============================================================
// REZZO API Auth Helper
// Drop-in helper for protected API routes.
// Usage: const auth = await getApiUser(request)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractBearerToken, type TokenPayload } from '@/lib/auth'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/domain/constants'

export interface ApiUser {
  id: string
  role: string
  status: string
}

/**
 * Validate the request and return the authenticated user.
 * Checks Authorization header, verifies token, confirms user exists in DB.
 * Returns null and writes a 401/403 response if auth fails.
 *
 * @param request - The NextRequest object
 * @param options - Optional: requireRole to enforce role-based access
 * @returns Tuple of [user | null, NextResponse | null]. If user is null, return the response.
 */
export async function getApiUser(
  request: NextRequest,
  options?: { requireRole?: string[] }
): Promise<{ user: ApiUser } | { response: NextResponse }> {
  // 1. Extract token
  const authHeader = request.headers.get('Authorization')
  const token = extractBearerToken(authHeader)

  // Fallback: check X-User-Id + X-Rezzo-Token for backward compat during migration
  const legacyUserId = request.headers.get('X-User-Id')
  const legacyToken = request.headers.get('X-Rezzo-Token')

  let payload: TokenPayload | null = null

  if (token) {
    payload = verifyToken(token)
  } else if (legacyUserId && legacyToken) {
    // Legacy path: verify the old-style token
    payload = verifyToken(legacyToken)
    // Also verify the userId matches
    if (payload && payload.userId !== legacyUserId) {
      payload = null
    }
  }

  if (!payload) {
    return {
      response: NextResponse.json(
        errorResponse('AUTH_REQUIRED', 'Valid authentication token required'),
        { status: 401 }
      ),
    }
  }

  // 2. Confirm user exists and is active
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, status: true },
  })

  if (!user || user.status !== 'ACTIVE') {
    return {
      response: NextResponse.json(
        errorResponse('AUTH_FORBIDDEN', 'User not found or account suspended'),
        { status: 403 }
      ),
    }
  }

  // 3. Role check
  if (options?.requireRole && !options.requireRole.includes(user.role)) {
    return {
      response: NextResponse.json(
        errorResponse('AUTH_FORBIDDEN', `Required role: ${options.requireRole.join(' or ')}`),
        { status: 403 }
      ),
    }
  }

  return { user: { id: user.id, role: user.role, status: user.status } }
}

/**
 * Shorthand: use in route handlers like:
 *   const auth = await getApiUser(request)
 *   if ('response' in auth) return auth.response
 *   const { id, role } = auth.user
 */
export function isAuthError(auth: { user: ApiUser } | { response: NextResponse }): auth is { response: NextResponse } {
  return 'response' in auth
}
