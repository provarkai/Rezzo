import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { logAdminAction } from '@/lib/domain/audit-service';
import { z } from 'zod';

// Marks an escalated AiJob reviewed — status stays ESCALATED as the
// historical record of what the AI flagged and why; reviewedAt/reviewedBy/
// reviewNotes is what actually clears it from the queue.
const reviewSchema = z.object({
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const existing = await db.aiJob.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'AI job not found'), { status: 404 });
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const job = await db.aiJob.update({
      where: { id },
      data: {
        reviewedBy: auth.user.id,
        reviewedAt: new Date(),
        reviewNotes: parsed.data.notes || null,
      },
    });

    await logAdminAction({
      actorId: auth.user.id,
      action: 'AI_JOB_REVIEWED',
      resourceType: 'AiJob',
      resourceId: id,
      metadata: { caseId: existing.caseId, risk: existing.risk, highRiskCategory: existing.highRiskCategory },
    });

    return NextResponse.json(successResponse({ job }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
