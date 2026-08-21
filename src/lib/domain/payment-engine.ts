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
} from './constants';
import { transitionCase, addCaseEvent } from './case-engine';

// ============ TYPES ============

export interface PaymentIntentResult {
  payment: Record<string, unknown>;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
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

  // Create payment record
  const payment = await db.payment.create({
    data: {
      caseId,
      quoteId,
      provider: 'MOCK',
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
    }
  );

  return {
    payment: payment as unknown as Record<string, unknown>,
    grossAmount,
    commissionAmount,
    netAmount,
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

  // Update payment to SUCCESS
  const updated = await db.payment.update({
    where: { id: paymentId },
    data: {
      status: 'SUCCESS',
      providerReference: ref,
    },
  });

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
