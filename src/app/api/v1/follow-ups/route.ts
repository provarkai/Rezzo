import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const followUps = await db.followUp.findMany({
      where: {
        status,
        case: { userId: auth.user.id },
      },
      include: {
        case: { select: { id: true, caseNumber: true, need: { select: { title: true } } } },
      },
      orderBy: { dueAt: 'asc' },
    });

    return NextResponse.json(successResponse({ followUps }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
