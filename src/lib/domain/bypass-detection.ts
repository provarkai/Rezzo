// ============================================================
// REZZO Anti-Bypass Detection (PRD Upgrade §6-§7)
// ============================================================
//
// Detect likely circumvention signals in Case communication with
// progressive, proportionate intervention. This scans message text only —
// it never blocks a message and never accuses anyone. It logs a
// CommunicationEvent for every message (the Controlled Communication audit
// trail, §6.1) and, when a pattern matches, a BypassSignal for admin/ops
// review. Escalation to CONFIRMED and any enforcement action is a human
// decision this module does not make (§15: "never make a punitive decision
// without the required policy/human gate").

import { db } from '@/lib/db';
import {
  BYPASS_SIGNAL_TYPES,
  BYPASS_SEVERITY_LEVELS,
  BYPASS_SIGNAL_STATUSES,
  TRANSACTION_MODES,
} from './constants';

// Deliberately loose patterns — false positives are acceptable here because
// a single ambiguous match only ever produces a LOW-severity signal (a
// friendly reminder, §6.2 level 1), never an accusation or a block.
const PHONE_PATTERN = /(?:\+?234|0)[789]\d{9}\b/;
const ACCOUNT_NUMBER_PATTERN = /\b\d{10}\b/;

const OFF_PLATFORM_PHRASES = [
  /outside (?:the )?(?:app|rezzo|platform)/i,
  /off[\s-]?(?:the )?(?:app|platform)/i,
  /whatsapp me/i,
  /call me directly/i,
  /pay me directly/i,
  /cash payment/i,
  /avoid (?:the )?(?:rezzo )?fee/i,
  /skip rezzo/i,
  /no need for rezzo/i,
  /without rezzo/i,
];

const DIRECT_PAYMENT_PHRASES = [
  /(?:send|transfer|pay).{0,20}(?:account|acct)/i,
  /(?:my|this) (?:account|bank) (?:number|details)/i,
  /account number/i,
];

interface Detection {
  signalType: string;
  riskSignal: string;
}

function detect(body: string): Detection | null {
  if (OFF_PLATFORM_PHRASES.some((p) => p.test(body))) {
    return { signalType: BYPASS_SIGNAL_TYPES.OFF_PLATFORM_REQUEST, riskSignal: 'off_platform_language' };
  }
  if (DIRECT_PAYMENT_PHRASES.some((p) => p.test(body)) && ACCOUNT_NUMBER_PATTERN.test(body)) {
    return { signalType: BYPASS_SIGNAL_TYPES.DIRECT_PAYMENT_DETAILS, riskSignal: 'direct_payment_details' };
  }
  if (PHONE_PATTERN.test(body)) {
    return { signalType: BYPASS_SIGNAL_TYPES.REPEATED_CONTACT_REQUEST, riskSignal: 'contact_reference' };
  }
  return null;
}

/**
 * Log a CommunicationEvent for the message, and — if it matches a known
 * bypass pattern — a BypassSignal whose severity depends on how many open
 * signals already exist on this case (progressive intervention, §6.2:
 * 1st = LOW/reminder, 2nd = MEDIUM/warning, 3rd+ = HIGH/ops review).
 * Severity never reaches CONFIRMED here — that requires human review.
 */
export async function scanMessageForBypassSignals(params: {
  caseId: string;
  messageId: string;
  senderId: string;
  senderRole: string;
  channel: string;
  body: string;
}) {
  const { caseId, messageId, senderId, senderRole, channel, body } = params;
  const detected = detect(body);

  await db.communicationEvent.create({
    data: {
      caseId,
      actorType: senderRole,
      actorId: senderId,
      channel,
      riskSignal: detected?.riskSignal ?? null,
      messageId,
    },
  });

  if (!detected) return null;

  const priorSignalCount = await db.bypassSignal.count({
    where: { caseId, status: { in: [BYPASS_SIGNAL_STATUSES.OPEN, BYPASS_SIGNAL_STATUSES.REVIEWED] } },
  });

  const severity =
    priorSignalCount >= 2
      ? BYPASS_SEVERITY_LEVELS.HIGH
      : priorSignalCount === 1
        ? BYPASS_SEVERITY_LEVELS.MEDIUM
        : BYPASS_SEVERITY_LEVELS.LOW;

  const signal = await db.bypassSignal.create({
    data: {
      caseId,
      actorId: senderId,
      signalType: detected.signalType,
      severity,
      evidenceRef: messageId,
      status: BYPASS_SIGNAL_STATUSES.OPEN,
    },
  });

  // A single ambiguous mention never changes anything (§6.2: "Never suspend
  // solely because one ambiguous message contains a phone number or contact
  // reference"). Only flag the case's transaction mode once severity has
  // actually escalated past a first occurrence.
  if (severity !== BYPASS_SEVERITY_LEVELS.LOW) {
    await db.case.update({
      where: { id: caseId },
      data: { transactionMode: TRANSACTION_MODES.OFF_PLATFORM_SUSPECTED },
    });
  }

  return signal;
}
