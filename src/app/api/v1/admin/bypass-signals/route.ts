import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [signals, total] = await Promise.all([
      db.bypassSignal.findMany({
        where,
        include: {
          case: { select: { id: true, caseNumber: true, need: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.bypassSignal.count({ where }),
    ]);

    // BypassSignal.actorId isn't a foreign key (the actor may not always be
    // a platform user), so resolve display names in a second, batched query
    // rather than a Prisma relation.
    const actorIds = [...new Set(signals.map((s) => s.actorId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, role: true, profile: { select: { displayName: true } } },
        })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));

    // Ordered most-recent-first at the DB level (before pagination), so
    // re-sorting by severity here would only reshuffle within the current
    // page and misrepresent later pages. Use ?severity= to filter instead.
    const enriched = signals.map((s) => {
      const actor = s.actorId ? actorById.get(s.actorId) : undefined;
      return {
        id: s.id,
        caseId: s.caseId,
        caseNumber: s.case.caseNumber,
        caseTitle: s.case.need?.title || null,
        actorId: s.actorId,
        actorName: actor?.profile?.displayName || null,
        actorRole: actor?.role || null,
        signalType: s.signalType,
        severity: s.severity,
        status: s.status,
        evidenceRef: s.evidenceRef,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json(successResponse({
      signals: enriched,
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
