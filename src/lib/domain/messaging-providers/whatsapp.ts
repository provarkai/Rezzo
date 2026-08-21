// ============================================================
// WhatsApp (Meta Cloud API) — low-level adapter
// ============================================================
//
// Deliberately has zero dependency on db/case-engine/ai-orchestrator —
// mirrors payment-providers/paystack.ts's split for the same reason: the
// signing/verification logic is pure and worth unit-testing on its own,
// separate from the DB-touching orchestration in whatsapp-service.ts that
// calls it.

import crypto from 'crypto';

const GRAPH_API_VERSION = 'v20.0';

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not set');
  return token;
}

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set');
  return id;
}

/**
 * Meta sends/expects phone numbers without a leading "+" (e.g.
 * "2348012345678"). The rest of REZZO stores them with one (seed data:
 * "+2348012345678"). Normalize to the "+"-prefixed form everywhere a
 * WhatsApp number touches a User record, so the same customer messaging
 * in matches the account they'd log into the app with.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  return `+${digits}`;
}

export async function sendWhatsAppMessage(toPhone: string, text: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${getPhoneNumberId()}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone.replace(/^\+/, ''),
        type: 'text',
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WhatsApp send failed (${res.status}): ${body}`);
  }
}

/**
 * Meta signs each webhook body with HMAC-SHA256 of the app secret (not the
 * access token — a separate credential), sent as `x-hub-signature-256:
 * sha256=<hex>`. Verify against the raw body, same reasoning as the
 * Paystack webhook: hashing a re-serialized JSON.stringify() of the parsed
 * body can silently differ from what was actually signed.
 */
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const signatureBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
