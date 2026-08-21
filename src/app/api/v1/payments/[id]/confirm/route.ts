import { NextRequest, NextResponse } from 'next/server';
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
