import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { logAdminAction } from '@/lib/domain/audit-service';
import { z } from 'zod';

// Approve/retire (toggle active) and mark re-verified (bump lastChecked) —
// the two actions the admin map calls for. Full field edits aren't
// exposed here; retiring a stale source and adding a fresh one covers the
// same need without a bigger edit form.
const updateSchema = z.object({
  active: z.boolean().optional(),
  markChecked: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const existing = await db.knowledgeSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Knowledge source not found'), { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.active !== undefined) data.active = parsed.data.active;
    if (parsed.data.markChecked) data.lastChecked = new Date();

    const source = await db.knowledgeSource.update({ where: { id }, data });

    await logAdminAction({
      actorId: auth.user.id,
      action: parsed.data.active === false ? 'KNOWLEDGE_SOURCE_RETIRED' : 'KNOWLEDGE_SOURCE_UPDATED',
      resourceType: 'KnowledgeSource',
      resourceId: id,
      metadata: { active: source.active },
    });

    return NextResponse.json(successResponse({ source }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
