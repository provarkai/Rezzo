import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { confirmPayment, processPayout } from '@/lib/domain/payment-engine';
import { verifyPaystackSignature } from '@/lib/domain/payment-providers/paystack';
import { logger } from '@/lib/logger';

// Paystack calls this directly — no REZZO auth token, no logged-in user.
// Trust is established entirely by the HMAC signature on the raw body, so
// this must read request.text() (not .json()) before anything else: hashing
// a re-serialized JSON.stringify() of the parsed body can differ byte-for-
// byte from what Paystack signed and silently fail verification.
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Could not read request body'), { status: 400 });
  }

  const signature = request.headers.get('x-paystack-signature');
  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json(errorResponse('FORBIDDEN', 'Invalid signature'), { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);

    if (event?.event !== 'charge.success') {
      // Ack anything we don't act on so Paystack stops retrying it.
      return NextResponse.json(successResponse({ ignored: true }));
    }

    const reference: string | undefined = event.data?.reference;
    if (!reference) {
      return NextResponse.json(successResponse({ ignored: true }));
    }

    const payment = await db.payment.findFirst({ where: { providerReference: reference } });
    if (!payment) {
      // Nothing on our side to reconcile this to — ack rather than 500 so
      // Paystack doesn't retry forever, but don't pretend to confirm it.
      return NextResponse.json(successResponse({ ignored: true, reason: 'no matching payment' }));
    }

    // Duplicate delivery (Paystack retries until it gets a 2xx) — already
    // handled, don't re-run side effects (PAY-02: no duplicate state).
    if (payment.status !== 'PENDING') {
      return NextResponse.json(successResponse({ payment: { id: payment.id, status: payment.status } }));
    }

    // Cross-check the amount Paystack actually charged against what we
    // asked for. A mismatch means the reference matched but the amount
    // didn't — don't confirm on trust alone.
    const paidKobo = Number(event.data?.amount ?? 0);
    const expectedKobo = Math.round(payment.grossAmount * 100);
    if (paidKobo !== expectedKobo) {
      logger.warn('Paystack webhook amount mismatch', { paymentId: payment.id, reference, expectedKobo, paidKobo });
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Amount mismatch: expected ${expectedKobo} kobo, got ${paidKobo}`),
        { status: 400 }
      );
    }

    const funded = await confirmPayment(payment.id, reference);

    try {
      await processPayout(payment.id);
    } catch (err) {
      // Payout processing is async, continue — but a payment stuck FUNDED
      // with no payout is worth knowing about, not silently dropping.
      logger.warn('Payout processing failed after Paystack confirm', { paymentId: payment.id, error: err });
    }

    return NextResponse.json(successResponse({ payment: funded }));
  } catch (error) {
    logger.error('Paystack webhook processing failed', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    // 500 so Paystack retries — this branch means something on our side
    // failed, not that the webhook itself was bad.
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
