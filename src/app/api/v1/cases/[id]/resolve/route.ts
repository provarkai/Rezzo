import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { customerApproveResolution } from '@/lib/domain/case-engine';
import { notify } from '@/lib/domain/notification-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const resolved = await customerApproveResolution(id, auth.user.id);

    try {
      const acceptedQuote = await db.quote.findFirst({
        where: { caseId: id, status: 'ACCEPTED' },
        include: { professional: true },
      });
      if (acceptedQuote?.professional?.userId && resolved) {
        await notify({
          userId: acceptedQuote.professional.userId,
          caseId: id,
          type: 'CASE_RESOLVED',
          title: `Case resolved — ${resolved.caseNumber}`,
          body: 'The customer confirmed the work is complete.',
        });
      }
    } catch {
      // Notification is best-effort
    }

    return NextResponse.json(successResponse({ case: resolved }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
