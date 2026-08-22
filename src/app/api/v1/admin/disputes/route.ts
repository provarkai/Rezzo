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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [disputes, total] = await Promise.all([
      db.dispute.findMany({
        where,
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              status: true,
              need: { select: { title: true } },
              payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { grossAmount: true, status: true } },
              quotes: {
                where: { status: 'ACCEPTED' },
                select: { professional: { select: { user: { select: { profile: { select: { displayName: true } } } } } } },
              },
            },
          },
          openedByUser: { select: { role: true, profile: { select: { displayName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.dispute.count({ where }),
    ]);

    const enriched = disputes.map((d) => ({
      id: d.id,
      caseId: d.caseId,
      caseNumber: d.case.caseNumber,
      caseTitle: d.case.need?.title || null,
      caseStatus: d.case.status,
      professionalName: d.case.quotes[0]?.professional?.user?.profile?.displayName || null,
      payment: d.case.payments[0] || null,
      openedByName: d.openedByUser.profile?.displayName || null,
      openedByRole: d.openedByUser.role,
      reason: d.reason,
      status: d.status,
      professionalResponse: d.professionalResponse,
      professionalRespondedAt: d.professionalRespondedAt,
      outcome: d.outcome,
      resolutionCode: d.resolutionCode,
      resolutionNotes: d.resolutionNotes,
      resolvedAt: d.resolvedAt,
      createdAt: d.createdAt,
    }));

    return NextResponse.json(successResponse({
      disputes: enriched,
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
