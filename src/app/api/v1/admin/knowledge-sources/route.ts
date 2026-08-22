import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { logAdminAction } from '@/lib/domain/audit-service';
import { z } from 'zod';

// PRD Implementation Pack §20 admin map, "Knowledge: Approve/retire
// sources." Includes inactive rows too (unlike the customer-facing
// GET /cases/[id]/sources, which only ever returns active: true) — an
// admin needs to see what's retired to decide whether to reactivate it.
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;

    const sources = await db.knowledgeSource.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ active: 'desc' }, { authorityLevel: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(successResponse({ sources }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}

const createSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  authorityLevel: z.enum(['A', 'B', 'C']),
  title: z.string().min(1, 'Title is required'),
  url: z.string().url().optional().or(z.literal('')),
  summary: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const source = await db.knowledgeSource.create({
      data: {
        category: parsed.data.category,
        authorityLevel: parsed.data.authorityLevel,
        title: parsed.data.title,
        url: parsed.data.url || null,
        contentJson: { summary: parsed.data.summary || null, source: parsed.data.source || null },
        active: true,
        lastChecked: new Date(),
      },
    });

    await logAdminAction({
      actorId: auth.user.id,
      action: 'KNOWLEDGE_SOURCE_CREATED',
      resourceType: 'KnowledgeSource',
      resourceId: source.id,
      metadata: { category: source.category, title: source.title },
    });

    return NextResponse.json(successResponse({ source }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
