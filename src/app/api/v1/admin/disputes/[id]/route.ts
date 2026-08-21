import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { resolveDispute } from '@/lib/domain/payment-engine';
import { logAdminAction } from '@/lib/domain/audit-service';
import { z } from 'zod';

// PRD §10.2 steps 5-7: admin reviews the assembled case (already available
// via GET /cases/[id], which returns quotes/payments/messages/proofItems/
// disputes together) and records an outcome. Money movement is simulated
// the same way the rest of V1's payment layer is (MOCK/instant), not an
// actual provider refund call.
const resolveSchema = z.object({
  outcome: z.enum(['REFUND', 'PARTIAL_REFUND', 'RELEASE_PAYOUT', 'DISMISSED']),
  resolutionCode: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const dispute = await resolveDispute(
      id,
      auth.user.id,
      parsed.data.outcome,
      parsed.data.resolutionCode,
      parsed.data.notes
    );

    await logAdminAction({
      actorId: auth.user.id,
      action: `DISPUTE_RESOLVED_${parsed.data.outcome}`,
      resourceType: 'Dispute',
      resourceId: id,
      metadata: { resolutionCode: parsed.data.resolutionCode || null, notes: parsed.data.notes || null },
    });

    return NextResponse.json(successResponse({ dispute }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
