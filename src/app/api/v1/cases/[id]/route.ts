import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { getCaseWithDetails } from '@/lib/domain/case-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const caseDetails = await getCaseWithDetails(id);

    if (!caseDetails) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }

    // Verify user has access (is participant or admin)
    const isParticipant = caseDetails.participants.some(
      (p: Record<string, unknown>) => (p.userId as string) === auth.user.id
    );
    if (!isParticipant && auth.user.role !== 'ADMIN' && caseDetails.case.userId !== auth.user.id) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'You do not have access to this case'), { status: 403 });
    }

    return NextResponse.json(successResponse(caseDetails));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
