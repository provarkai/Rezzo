import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, CASE_EVENTS } from '@/lib/domain/constants';
import { submitProof, addCaseEvent, transitionCase } from '@/lib/domain/case-engine';
import { notify } from '@/lib/domain/notification-service';
import { z } from 'zod';

const proofSchema = z.object({
  items: z.array(z.object({
    type: z.enum(['PHOTO', 'VIDEO', 'DOCUMENT', 'REPORT']),
    description: z.string().optional(),
    storageKey: z.string().optional(),
  })).min(1, 'At least one proof item is required'),
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
    const parsed = proofSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const proofItems = await submitProof(id, parsed.data.items);

    // Add PROOF_SUBMITTED event
    await addCaseEvent(id, CASE_EVENTS.PROOF_SUBMITTED, 'PROFESSIONAL', auth.user.id, {
      itemCount: proofItems.length,
      types: proofItems.map((item) => item.type),
    });

    // Normally FUNDED -> IN_PROGRESS already happened when the customer
    // confirmed the appointment (POST /bookings/[id]/confirm). Not every
    // case goes through a booking, though, so fall through it here too —
    // otherwise a case that skipped booking would get stuck unable to
    // reach PROOF at all (FUNDED -> PROOF isn't a valid direct transition).
    try {
      await transitionCase(id, 'IN_PROGRESS', auth.user.id, 'PROFESSIONAL');
    } catch {
      // Already past IN_PROGRESS, or booking confirmation got there first
    }

    // Transition case to PROOF
    try {
      await transitionCase(id, 'PROOF', auth.user.id, 'PROFESSIONAL');
    } catch {
      // May already be in PROOF
    }

    // Then to CUSTOMER_REVIEW
    try {
      await transitionCase(id, 'CUSTOMER_REVIEW', auth.user.id, 'PROFESSIONAL');
    } catch {
      // May not be ready yet
    }

    try {
      const caseRecord = await db.case.findUnique({ where: { id }, select: { userId: true, caseNumber: true } });
      if (caseRecord) {
        await notify({
          userId: caseRecord.userId,
          caseId: id,
          type: 'PROOF_SUBMITTED',
          title: `Proof submitted for ${caseRecord.caseNumber}`,
          body: 'The professional submitted evidence of completed work. Please review it.',
        });
      }
    } catch {
      // Notification is best-effort
    }

    return NextResponse.json(successResponse({ proofItems }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
