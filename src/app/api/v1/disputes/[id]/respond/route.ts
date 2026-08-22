import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { respondToDispute } from '@/lib/domain/case-engine';
import { notify } from '@/lib/domain/notification-service';
import { z } from 'zod';

// PRD §10.2 step 4: "Professional submits response/evidence." Ownership
// (is this the case's assigned professional) is checked inside
// respondToDispute() itself, since that's where the accepted-quote lookup
// already happens.
const respondSchema = z.object({
  response: z.string().min(5, 'Please provide a response (at least 5 characters)'),
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
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const dispute = await respondToDispute(id, auth.user.id, parsed.data.response);

    try {
      const caseRecord = await db.case.findUnique({ where: { id: dispute.caseId }, select: { userId: true, caseNumber: true } });
      if (caseRecord) {
        await notify({
          userId: caseRecord.userId,
          caseId: dispute.caseId,
          type: 'DISPUTE_RESPONSE_SUBMITTED',
          title: `Professional responded — ${caseRecord.caseNumber}`,
          body: 'The professional submitted a response to your dispute. REZZO will review it.',
        });
      }
    } catch {
      // Notification is best-effort
    }

    return NextResponse.json(successResponse({ dispute }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not the professional assigned') ? 403 : 500;
    return NextResponse.json(errorResponse(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message), { status });
  }
}
