import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { z } from 'zod';

// The customer can dismiss a follow-up they don't want, or the app can mark
// one COMPLETED once they've acted on it (e.g. started a related case).
// PENDING/SENT are set by the system (scheduleFollowUp), not by this route.
const updateSchema = z.object({
  status: z.enum(['DISMISSED', 'COMPLETED']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const existing = await db.followUp.findUnique({
      where: { id },
      include: { case: { select: { userId: true } } },
    });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Follow-up not found'), { status: 404 });
    }
    if (existing.case.userId !== auth.user.id) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'You do not have access to this follow-up'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const followUp = await db.followUp.update({
      where: { id },
      data: { status: parsed.data.status },
    });

    return NextResponse.json(successResponse({ followUp }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
