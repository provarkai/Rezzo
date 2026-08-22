import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

// PRD §12.3 source hierarchy: surface the trusted references behind a
// case's route, clearly labelled by authority level — official government
// source, officially published process, verified professional guidance, or
// general/AI-assisted. KnowledgeSource.category isn't a real FK (matches
// either the fine categoryId AI REZZO assigned, e.g. "PASSPORT", or the
// coarser vertical, e.g. "GOVERNMENT_DOCUMENTATION" — the original seed
// data only went vertical-level, newer rows are category-level).
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
      include: { matter: true, participants: true },
    });
    if (!caseRecord) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }
    const isParticipant = caseRecord.participants.some((p) => p.userId === auth.user.id);
    if (!isParticipant && caseRecord.userId !== auth.user.id && auth.user.role !== 'ADMIN') {
      return NextResponse.json(errorResponse('FORBIDDEN', 'You do not have access to this case'), { status: 403 });
    }

    const routeJson = caseRecord.routeJson as Record<string, unknown> | null;
    const categories = [caseRecord.matter?.categoryId, routeJson?.vertical as string | undefined].filter(
      (c): c is string => !!c
    );

    const sources = categories.length
      ? await db.knowledgeSource.findMany({
          where: { category: { in: categories }, active: true },
          orderBy: { authorityLevel: 'asc' }, // A before B before C
        })
      : [];

    return NextResponse.json(successResponse({ sources }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
