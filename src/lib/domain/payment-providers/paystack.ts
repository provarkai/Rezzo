// ============================================================
// Paystack payment provider adapter
// ============================================================
//
// Only active when PAYSTACK_SECRET_KEY is set in the environment. Without
// it, payment-engine.ts falls back to the existing MOCK/self-confirm flow,
// so local dev and demo accounts keep working without a live key.
//
// Docs: https://paystack.com/docs/api/transaction/ and
// https://paystack.com/docs/payments/webhooks/

import crypto from 'crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';

export function isPaystackConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Starts a Paystack transaction and returns the hosted checkout URL to
 * redirect the customer to. Confirmation happens later via webhook
 * (charge.success), never from this call — Paystack settles asynchronously.
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountNaira * 100), // Paystack takes kobo
      reference: params.reference,
      metadata: params.metadata,
      ...(process.env.APP_URL ? { callback_url: `${process.env.APP_URL}/payments/callback` } : {}),
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json?.message || 'Failed to initialize Paystack transaction');
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

/**
 * Paystack signs each webhook body with HMAC-SHA512 of the secret key,
 * sent as the `x-paystack-signature` header. Verify against the raw
 * (unparsed) request body — hashing the re-serialized JSON can produce a
 * different string and silently fail verification.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  // Checked directly rather than via getSecretKey(), which throws — an
  // unconfigured key should make every webhook request fail closed (401),
  // not 500. This route call isn't wrapped in try/catch, so a throw here
  // used to turn "not configured" into an unhandled exception instead of
  // the clean rejection every other invalid-signature case gets.
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!signature || !secretKey) return false;
  const expected = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const signatureBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
