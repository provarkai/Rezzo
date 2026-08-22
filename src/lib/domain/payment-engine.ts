// ============================================================
// REZZO Payment Engine
// ============================================================

import { db } from '@/lib/db';
import {
  COMMISSION_RATE,
  CURRENCY,
  CASE_EVENTS,
  PROTECTION_STATUSES,
  TRANSACTION_MODES,
  COMMISSION_REVERSAL_STATUSES,
  PROTECTION_BENEFIT_TYPES,
  PROTECTION_BENEFIT_STATUSES,
  DISPUTE_STATUSES,
  DISPUTE_OUTCOMES,
  ROLES,
} from './constants';
import { transitionCase, addCaseEvent } from './case-engine';
import { notify } from './notification-service';
import { isPaystackConfigured, initializePaystackTransaction } from './payment-providers/paystack';
import { trackEvent } from '@/lib/analytics';

// ============ TYPES ============

export interface PaymentIntentResult {
  payment: Record<string, unknown>;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  // Only set when a live provider (Paystack) is configured — the caller
  // should redirect the customer there instead of self-confirming.
  authorizationUrl?: string;
}

// ============ CREATE PAYMENT INTENT ============

export async function createPaymentIntent(
  caseId: string,
  quoteId: string
): Promise<PaymentIntentResult> {
  const caseRecord = await db.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) throw new Error('Case not found');

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { professional: true },
  });
  if (!quote) throw new Error('Quote not found');
  if (quote.caseId !== caseId) throw new Error('Quote does not belong to this case');

  const grossAmount = quote.totalAmount;
  const commissionAmount = grossAmount * COMMISSION_RATE;
  const netAmount = grossAmount - commissionAmount;

  const idempotencyKey = `pay_${caseId}_${quoteId}_${Date.now()}`;

  // When a live provider is configured, start a real transaction and use
  // its reference as our own — confirmPayment() only ever runs from that
  // provider's signature-verified webhook from here on (see
  // POST /payments/webhooks/paystack), never from a client click. Without a
  // key, provider stays MOCK and the existing client-confirm demo flow
  // (POST /payments/[id]/confirm) still works unchanged.
  let provider = 'MOCK';
  let providerReference: string | null = null;
  let authorizationUrl: string | undefined;

  if (isPaystackConfigured()) {
    const customer = await db.user.findUnique({ where: { id: caseRecord.userId } });
    if (!customer?.email) {
      throw new Error('A verified email is required to pay with Paystack — add one to your profile first');
    }
    const init = await initializePaystackTransaction({
      email: customer.email,
      amountNaira: grossAmount,
      reference: idempotencyKey,
      metadata: { caseId, quoteId },
    });
    provider = 'PAYSTACK';
    providerReference = init.reference;
    authorizationUrl = init.authorizationUrl;
  }

  // Create payment record
  const payment = await db.payment.create({
    data: {
      caseId,
      quoteId,
      provider,
      providerReference,
      grossAmount,
      commissionAmount,
      netAmount,
      currency: CURRENCY,
      status: 'PENDING',
      idempotencyKey,
    },
  });

  // Transition case to PAYMENT
  try {
    await transitionCase(caseId, 'PAYMENT', caseRecord.userId, 'CUSTOMER');
  } catch {
    // May already be in payment state
  }

  // Add PAYMENT_INITIATED event
  await addCaseEvent(
    caseId,
    CASE_EVENTS.PAYMENT_INITIATED,
    'CUSTOMER',
    caseRecord.userId,
    {
      paymentId: payment.id,
      grossAmount,
      commissionAmount,
      netAmount,
      currency: CURRENCY,
      provider,
    }
  );

  return {
    payment: payment as unknown as Record<string, unknown>,
    grossAmount,
    commissionAmount,
    netAmount,
    authorizationUrl,
  };
}

// ============ CONFIRM PAYMENT (simulates webhook) ============

export async function confirmPayment(
  paymentId: string,
  providerReference?: string
) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { case: true, quote: { include: { professional: true } } },
  });

  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'PENDING') {
    throw new Error(`Payment is already in ${payment.status} state`);
  }

  const ref = providerReference || `mock_ref_${Date.now()}`;

  // The check above and this write aren't atomic — two concurrent callers
  // (a Paystack webhook retry racing the original delivery, or a user
  // double-clicking the MOCK confirm button) can both read PENDING before
  // either write lands, then both fall through and double-fund the case:
  // two commissionEntry rows, two payout attempts, two FUNDED transitions.
  // SQLite's single-writer lock hid this in dev; Postgres in production
  // won't. Guard it with an atomic conditional update — only the caller
  // that actually flips PENDING -> SUCCESS gets to proceed.
  const claimed = await db.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: {
      status: 'SUCCESS',
      providerReference: ref,
    },
  });
  if (claimed.count === 0) {
    // We read PENDING above, but the conditional update above claimed
    // zero rows — a concurrent call already flipped it first.
    throw new Error('Payment was already confirmed by a concurrent request');
  }

  // Then immediately fund (simulating instant settlement)
  const funded = await db.payment.update({
    where: { id: paymentId },
    data: {
      status: 'FUNDED',
    },
  });

  // Transition case to FUNDED
  try {
    await transitionCase(payment.caseId, 'FUNDED', payment.case.userId, 'CUSTOMER');
  } catch {
    // Already transitioning
  }

  // Record the platform commission as its own reversible ledger entry,
  // independent of the commissionAmount snapshot already on Payment (PRD
  // Upgrade §9 "Every commission is ledgered", §14 CommissionEntry).
  const commissionEntry = await db.commissionEntry.create({
    data: {
      paymentId: payment.id,
      baseAmount: payment.grossAmount,
      rate: COMMISSION_RATE,
      commissionAmount: payment.commissionAmount,
      reversalStatus: COMMISSION_REVERSAL_STATUSES.NONE,
    },
  });

  // A case whose payment has been made and funded through REZZO becomes a
  // REZZO Protected Case (PRD Upgrade §10) — the transaction, and the proof/
  // dispute history that follows it, are now tied to the Case.
  await db.case.update({
    where: { id: payment.caseId },
    data: {
      protectionEligible: true,
      protectionStatus: PROTECTION_STATUSES.PROTECTED,
      transactionMode: TRANSACTION_MODES.ON_PLATFORM,
    },
  });

  const professionalVerified = ['VERIFIED', 'TRUSTED', 'EXPERT'].includes(
    payment.quote?.professional?.verificationStatus ?? ''
  );
  await issueProtectionBenefits(payment.caseId, professionalVerified);

  // Add PAYMENT_CONFIRMED event
  await addCaseEvent(
    payment.caseId,
    CASE_EVENTS.PAYMENT_CONFIRMED,
    'SYSTEM',
    null,
    {
      paymentId: payment.id,
      providerReference: ref,
      grossAmount: payment.grossAmount,
      status: 'FUNDED',
      commissionEntryId: commissionEntry.id,
      commissionAmount: commissionEntry.commissionAmount,
      protectionStatus: PROTECTION_STATUSES.PROTECTED,
    }
  );

  try {
    await notify({
      userId: payment.case.userId,
      caseId: payment.caseId,
      type: 'PAYMENT_CONFIRMED',
      title: `Payment confirmed for ${payment.case.caseNumber}`,
      body: 'Your payment is funded and protected. The professional can now begin work.',
    });
    if (payment.quote?.professional?.userId) {
      await notify({
        userId: payment.quote.professional.userId,
        caseId: payment.caseId,
        type: 'PAYMENT_CONFIRMED',
        title: `Payment funded — ${payment.case.caseNumber}`,
        body: 'The customer\'s payment is confirmed. You can begin work.',
      });
    }
  } catch {
    // Notification is best-effort
  }

  trackEvent({
    event: 'payment_confirmed',
    distinctId: payment.case.userId,
    properties: { caseId: payment.caseId, paymentId: payment.id, grossAmount: payment.grossAmount, provider: payment.provider },
  }).catch(() => {});

  return funded;
}

// ============ PROTECTED CASE BENEFITS ============

// Which ProtectionBenefit rows a REZZO Protected Case gets, and whether each
// is immediately active or just eligible-but-not-yet-triggered (PRD Upgrade
// §10). VERIFIED_PROFESSIONAL is decided by the actual professional's
// verification state; FOLLOW_UP stays eligible-but-inactive until a
// resolution actually schedules one (a later slice).
const ALWAYS_ACTIVE_BENEFITS = [
  PROTECTION_BENEFIT_TYPES.PAYMENT_RECORD,
  PROTECTION_BENEFIT_TYPES.PROOF_RECORD,
  PROTECTION_BENEFIT_TYPES.DISPUTE_PATH,
  PROTECTION_BENEFIT_TYPES.CASE_HISTORY,
  PROTECTION_BENEFIT_TYPES.SUPPORT,
] as const;

/**
 * Issue (or refresh) the standard set of REZZO Protected Case benefits for
 * a case. Idempotent — safe to call again for the same case (e.g. if a
 * dispute reopens the case and a new payment is later confirmed).
 */
export async function issueProtectionBenefits(caseId: string, professionalVerified: boolean) {
  const benefits = [
    ...ALWAYS_ACTIVE_BENEFITS.map((benefitType) => ({
      benefitType,
      eligible: true,
      status: PROTECTION_BENEFIT_STATUSES.ACTIVE,
    })),
    {
      benefitType: PROTECTION_BENEFIT_TYPES.VERIFIED_PROFESSIONAL,
      eligible: professionalVerified,
      status: professionalVerified
        ? PROTECTION_BENEFIT_STATUSES.ACTIVE
        : PROTECTION_BENEFIT_STATUSES.INACTIVE,
    },
    {
      benefitType: PROTECTION_BENEFIT_TYPES.FOLLOW_UP,
      eligible: true,
      status: PROTECTION_BENEFIT_STATUSES.INACTIVE, // becomes ACTIVE once a FollowUp is actually scheduled
    },
  ];

  await Promise.all(
    benefits.map(({ benefitType, eligible, status }) =>
      db.protectionBenefit.upsert({
        where: { caseId_benefitType: { caseId, benefitType } },
        update: { eligible, status },
        create: { caseId, benefitType, eligible, status },
      })
    )
  );
}

// ============ PROCESS PAYOUT ============

export async function processPayout(paymentId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { quote: true },
  });

  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'FUNDED') {
    throw new Error(`Payment must be FUNDED to process payout, current: ${payment.status}`);
  }
  if (!payment.quote?.professionalId) {
    throw new Error('No professional associated with this payment');
  }

  // Update payment status
  await db.payment.update({
    where: { id: paymentId },
    data: { status: 'PAYOUT_PENDING' },
  });

  // Create payout record
  const payout = await db.payout.create({
    data: {
      paymentId,
      professionalId: payment.quote.professionalId,
      amount: payment.netAmount,
      providerReference: `payout_${Date.now()}`,
      status: 'COMPLETED', // Mock: instant payout
    },
  });

  // Update payment to PAID_OUT
  await db.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID_OUT' },
  });

  return payout;
}

// ============ RESOLVE DISPUTE (admin) ============

// PRD §10.2 step 5-7: "Admin ... reviews the Case. Outcome is recorded.
// Refund/payout/closure actions occur according to applicable terms." Lives
// here (not case-engine.ts) because it touches Payment/CommissionEntry,
// which only payment-engine.ts has — case-engine.ts is imported by this
// file, not the other way round, so this keeps that one-directional.
export async function resolveDispute(
  disputeId: string,
  adminId: string,
  outcome: string,
  resolutionCode?: string,
  notes?: string
) {
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      case: {
        include: {
          payments: { orderBy: { createdAt: 'desc' } },
          quotes: { where: { status: 'ACCEPTED' }, include: { professional: true } },
        },
      },
    },
  });
  if (!dispute) throw new Error('Dispute not found');
  if (dispute.status === DISPUTE_STATUSES.RESOLVED || dispute.status === DISPUTE_STATUSES.CLOSED) {
    throw new Error(`Dispute is already ${dispute.status}`);
  }

  const payment = dispute.case.payments[0]; // most recent payment on the case
  const professionalUserId = dispute.case.quotes[0]?.professional?.userId;

  if (outcome === DISPUTE_OUTCOMES.REFUND || outcome === DISPUTE_OUTCOMES.PARTIAL_REFUND) {
    if (payment) {
      await db.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      // Reverse the platform's commission on this payment too — REZZO
      // doesn't keep its cut on money that's going back to the customer.
      await db.commissionEntry.updateMany({
        where: { paymentId: payment.id, reversalStatus: COMMISSION_REVERSAL_STATUSES.NONE },
        data: {
          reversalStatus: outcome === DISPUTE_OUTCOMES.REFUND
            ? COMMISSION_REVERSAL_STATUSES.FULLY_REVERSED
            : COMMISSION_REVERSAL_STATUSES.PARTIALLY_REVERSED,
        },
      });
    }
    try {
      await transitionCase(dispute.caseId, 'REFUNDED', adminId, ROLES.ADMIN);
    } catch {
      // May already be past this state
    }
  } else {
    // RELEASE_PAYOUT / DISMISSED — dispute found in the professional's
    // favor. If payout hadn't gone out yet, let it proceed; either way,
    // work resumes (DISPUTED -> IN_PROGRESS is always a valid transition).
    if (outcome === DISPUTE_OUTCOMES.RELEASE_PAYOUT && payment?.status === 'FUNDED') {
      try {
        await processPayout(payment.id);
      } catch {
        // Best-effort — payout may already be in flight
      }
    }
    try {
      await transitionCase(dispute.caseId, 'IN_PROGRESS', adminId, ROLES.ADMIN);
    } catch {
      // May already be past this state
    }
  }

  const updated = await db.dispute.update({
    where: { id: disputeId },
    data: {
      status: DISPUTE_STATUSES.RESOLVED,
      outcome,
      resolutionCode: resolutionCode || null,
      resolutionNotes: notes || null,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    },
  });

  await addCaseEvent(dispute.caseId, CASE_EVENTS.DISPUTE_RESOLVED, ROLES.ADMIN, adminId, {
    disputeId,
    outcome,
    resolutionCode: resolutionCode || null,
  });

  try {
    await notify({
      userId: dispute.case.userId,
      caseId: dispute.caseId,
      type: 'DISPUTE_RESOLVED',
      title: `Dispute resolved — ${dispute.case.caseNumber}`,
      body: `Outcome: ${outcome.replace(/_/g, ' ').toLowerCase()}.${notes ? ' ' + notes : ''}`,
    });
    if (professionalUserId) {
      await notify({
        userId: professionalUserId,
        caseId: dispute.caseId,
        type: 'DISPUTE_RESOLVED',
        title: `Dispute resolved — ${dispute.case.caseNumber}`,
        body: `Outcome: ${outcome.replace(/_/g, ' ').toLowerCase()}.${notes ? ' ' + notes : ''}`,
      });
    }
  } catch {
    // Notification is best-effort
  }

  return updated;
}
