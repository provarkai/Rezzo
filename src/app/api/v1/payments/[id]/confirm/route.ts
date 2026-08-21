import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { confirmPayment, processPayout } from '@/lib/domain/payment-engine';
import { z } from 'zod';

const confirmSchema = z.object({
  providerReference: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    // This stands in for the payment provider's webhook telling us the
    // customer's money has actually moved. Only the customer who owns the
    // case (or an admin) may trigger that — not just any authenticated user
    // who knows the payment ID, which would otherwise let anyone fund and
    // trigger payout on someone else's payment.
    const payment = await db.payment.findUnique({
      where: { id },
      select: { case: { select: { userId: true } } },
    });
    if (!payment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Payment not found'), { status: 404 });
    }
    if (payment.case.userId !== auth.user.id && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Only the case owner can confirm this payment'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    const providerReference = parsed.success ? parsed.data.providerReference : undefined;

    // Confirm payment
    const funded = await confirmPayment(id, providerReference);

    // Auto-process payout for V1
    try {
      await processPayout(id);
    } catch {
      // Payout processing is async, continue
    }

    return NextResponse.json(successResponse({ payment: funded }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
