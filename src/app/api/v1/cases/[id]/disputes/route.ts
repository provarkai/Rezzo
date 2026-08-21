import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, ROLES } from '@/lib/domain/constants';
import { openDispute } from '@/lib/domain/case-engine';
import { notify } from '@/lib/domain/notification-service';
import { trackEvent } from '@/lib/analytics';
import { z } from 'zod';

const disputeSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason for the dispute (at least 5 characters)'),
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
    const parsed = disputeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    // Only the case owner, the assigned professional, or an admin can open
    // a dispute — otherwise any logged-in user could disrupt someone
    // else's case by ID.
    const caseRecord = await db.case.findUnique({
      where: { id },
      include: { quotes: { where: { status: 'ACCEPTED' }, include: { professional: true } } },
    });
    if (!caseRecord) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }
    const isOwner = caseRecord.userId === auth.user.id;
    const isAssignedProfessional = caseRecord.quotes[0]?.professional?.userId === auth.user.id;
    if (!isOwner && !isAssignedProfessional && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'You do not have access to this case'),
        { status: 403 }
      );
    }
    const actorType = isOwner ? ROLES.CUSTOMER : isAssignedProfessional ? ROLES.PROFESSIONAL : ROLES.ADMIN;

    const dispute = await openDispute(id, auth.user.id, parsed.data.reason, actorType);

    try {
      // Notify whichever side didn't open it.
      const professionalUserId = caseRecord.quotes[0]?.professional?.userId;
      const notifyUserId = isOwner ? professionalUserId : caseRecord.userId;
      if (notifyUserId) {
        await notify({
          userId: notifyUserId,
          caseId: id,
          type: 'DISPUTE_OPENED',
          title: `Dispute opened — ${caseRecord.caseNumber}`,
          body: parsed.data.reason,
        });
      }
    } catch {
      // Notification is best-effort
    }

    trackEvent({
      event: 'dispute_opened',
      distinctId: auth.user.id,
      properties: { caseId: id, disputeId: dispute.id, openedByRole: actorType },
    }).catch(() => {});

    return NextResponse.json(successResponse({ dispute }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
