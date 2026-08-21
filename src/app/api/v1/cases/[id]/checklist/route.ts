import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { toggleChecklistItem } from '@/lib/domain/case-engine';
import { z } from 'zod';

// PRD §12.2: "tracks the customer's checklist" — lets the customer check
// off items from Matter.requiredDocuments as they gather them.
const checklistSchema = z.object({
  document: z.string().min(1),
  checked: z.boolean(),
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
    if (caseRecord.userId !== auth.user.id && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Only the case owner can update the checklist'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = checklistSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const updated = await toggleChecklistItem(id, parsed.data.document, parsed.data.checked);

    return NextResponse.json(successResponse({ case: updated }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
