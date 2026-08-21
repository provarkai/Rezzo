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

    // Only the case owner (or an admin) can approve resolution — otherwise
    // any logged-in user could mark someone else's case resolved by ID.
    const caseRecord = await db.case.findUnique({ where: { id }, select: { userId: true } });
    if (!caseRecord) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }
    if (caseRecord.userId !== auth.user.id && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Only the case owner can approve resolution'),
        { status: 403 }
      );
    }

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
