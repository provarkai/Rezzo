import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, PUBLIC_USER_SELECT } from '@/lib/domain/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const riskLevel = searchParams.get('riskLevel') || undefined;
    const state = searchParams.get('state') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (riskLevel) where.riskLevel = riskLevel;
    if (state) where.state = state;

    const [cases, total] = await Promise.all([
      db.case.findMany({
        where,
        include: {
          need: true,
          user: { select: PUBLIC_USER_SELECT },
          _count: {
            select: { events: true, quotes: true, messages: true, disputes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.case.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      cases,
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
