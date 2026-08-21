import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { listCaseDocuments } from '@/lib/domain/document-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const caseRecord = await db.case.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!caseRecord) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }
    const isParticipant = caseRecord.participants.some((p) => p.userId === auth.user.id);
    if (!isParticipant && caseRecord.userId !== auth.user.id && auth.user.role !== 'ADMIN') {
      return NextResponse.json(errorResponse('FORBIDDEN', 'You do not have access to this case'), { status: 403 });
    }

    const documents = await listCaseDocuments(id);

    return NextResponse.json(successResponse({ documents }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
