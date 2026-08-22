import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

// AI Oversight (PRD §16, Implementation Pack admin map: "AI Oversight:
// Jobs, confidence, failures, escalations"). Defaults to unreviewed
// escalations — the actual queue an admin needs to work — but any status
// is browsable via ?status=.
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ESCALATED';
    const onlyUnreviewed = searchParams.get('unreviewed') !== 'false';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { status };
    if (status === 'ESCALATED' && onlyUnreviewed) {
      where.reviewedAt = null;
    }

    const [jobs, total] = await Promise.all([
      db.aiJob.findMany({
        where,
        include: {
          case: { select: { id: true, caseNumber: true, need: { select: { title: true } } } },
          reviewer: { select: { profile: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.aiJob.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
