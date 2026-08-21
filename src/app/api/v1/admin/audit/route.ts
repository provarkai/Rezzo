import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (resourceType) where.resourceType = resourceType;

    const [entries, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { actor: { select: { role: true, profile: { select: { displayName: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    const enriched = entries.map((e) => ({
      id: e.id,
      actorName: e.actor?.profile?.displayName || null,
      actorRole: e.actor?.role || e.actorType,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      metadataJson: e.metadataJson,
      createdAt: e.createdAt,
    }));

    return NextResponse.json(successResponse({
      entries: enriched,
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
