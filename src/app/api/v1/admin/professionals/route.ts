import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, PUBLIC_USER_SELECT } from '@/lib/domain/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('verificationStatus') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const [professionals, total] = await Promise.all([
      db.professional.findMany({
        where,
        include: {
          user: { select: PUBLIC_USER_SELECT },
          skills: true,
          credentials: true,
          _count: {
            select: { reviews: true, bookings: true, quotes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.professional.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      professionals,
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
