// ============================================================
// REZZO WhatsApp Adapter — inbound orchestration (PRD §14.2)
// ============================================================
//
// "WhatsApp should be a major acquisition and access channel in V1. A
// customer can begin with a natural-language message ... and continue the
// structured Case in the REZZO app/web experience."
//
// The low-level send/verify/normalize functions live in
// messaging-providers/whatsapp.ts (kept dependency-free from db/
// case-engine/ai-orchestrator so they're unit-testable on their own).
// This file is the DB-touching half: turning an inbound message into a
// Case or a Message.
//
// Inert until WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are set — no
// demo credentials were provided for this one, unlike Paystack, so this
// has been written against Meta's documented request/webhook shapes but
// never exercised against a live number. Treat it as ready-to-wire, not
// verified end-to-end.

import { db } from '@/lib/db';
import { createCase, sendMessage } from './case-engine';
import { orchestrateCase } from './ai-orchestrator';
import { normalizePhone } from './messaging-providers/whatsapp';

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
