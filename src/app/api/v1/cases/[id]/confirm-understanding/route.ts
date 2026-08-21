import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { confirmUnderstanding } from '@/lib/domain/case-engine';
import { orchestrateCase } from '@/lib/domain/ai-orchestrator';
import { z } from 'zod';

const confirmSchema = z.object({
  confirmed: z.boolean(),
  correction: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const caseRecord = await db.case.findUnique({ where: { id }, select: { userId: true } });
    if (!caseRecord) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }
    if (caseRecord.userId !== auth.user.id) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Only the case owner can confirm this case'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const result = await confirmUnderstanding(id, auth.user.id, parsed.data.confirmed, parsed.data.correction);

    // On a correction, re-run AI REZZO against the updated Need right away
    // so the customer sees a fresh understanding rather than a stale one.
    if (!parsed.data.confirmed) {
      try {
        await orchestrateCase(id);
      } catch {
        // Re-orchestration is best-effort; the case is safely back in
        // UNDERSTANDING either way and can be retried.
      }
    }

    return NextResponse.json(successResponse({ case: result }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
