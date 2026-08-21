// ============================================================
// REZZO WhatsApp Adapter (PRD §14.2)
// ============================================================
//
// "WhatsApp should be a major acquisition and access channel in V1. A
// customer can begin with a natural-language message ... and continue the
// structured Case in the REZZO app/web experience."
//
// Uses Meta's WhatsApp Cloud API directly (no third-party BSP). Inert
// until WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are set — no demo
// credentials were provided for this one, unlike Paystack, so this has
// been written against Meta's documented request/webhook shapes but never
// exercised against a live number. Treat it as ready-to-wire, not
// verified end-to-end.

import crypto from 'crypto';
import { db } from '@/lib/db';
import { createCase, sendMessage } from './case-engine';
import { orchestrateCase } from './ai-orchestrator';

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

const CONVERSATIONAL_STATES = ['NEW', 'UNDERSTANDING', 'CLARIFICATION', 'CONFIRMATION'];

/**
 * Core inbound handler, deliberately separate from the route so the HTTP
 * layer stays thin. Text messages either continue an existing early-stage
 * case (logged as a Message, same as an in-app reply) or start a new one
 * (same path as the home screen's composer: createCase + orchestrateCase).
 * Non-text message types (voice notes, images, ...) are acknowledged but
 * not processed — there's no speech-to-text or image pipeline wired up
 * anywhere in this codebase to hand them to.
 */
export async function handleInboundWhatsAppMessage(params: {
  fromPhone: string;
  messageType: string;
  text?: string;
  displayName?: string;
}): Promise<{ replyText: string }> {
  const phone = normalizePhone(params.fromPhone);

  if (params.messageType !== 'text' || !params.text?.trim()) {
    return {
      replyText: "We received your message but can only read text for now — voice notes and photos aren't processed automatically yet. Could you type your request?",
    };
  }
  const body = params.text.trim();

  let user = await db.user.findFirst({ where: { phone } });
  if (!user) {
    // WhatsApp as an acquisition channel (PRD §14.2) means the first
    // contact can be someone with no REZZO account yet. Provision one tied
    // to their phone with no password — they can use REZZO entirely over
    // WhatsApp; setting a password to also use the app/web is a later step
    // this build doesn't have a flow for yet (no "claim this account" UI).
    user = await db.user.create({
      data: {
        phone,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        password: null,
      },
    });
    await db.profile.create({
      data: {
        userId: user.id,
        displayName: params.displayName || undefined,
      },
    });
  }

  const openCase = await db.case.findFirst({
    where: { userId: user.id, status: { in: CONVERSATIONAL_STATES } },
    orderBy: { createdAt: 'desc' },
  });

  if (openCase) {
    await sendMessage(openCase.id, user.id, body, 'WHATSAPP');
    return {
      replyText: `Got it — added to your case ${openCase.caseNumber}. You can follow along or reply here anytime.`,
    };
  }

  const caseRecord = await createCase(user.id, {
    title: body.slice(0, 100),
    rawInput: body,
    desiredOutcome: body,
  });
  orchestrateCase(caseRecord.id).catch(() => {});

  return {
    replyText: `Thanks — we've opened REZZO Case ${caseRecord.caseNumber} for you. We're looking into it now; you can also track it in the REZZO app.`,
  };
}
