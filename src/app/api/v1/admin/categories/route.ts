import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, SERVICE_CATEGORIES } from '@/lib/domain/constants';

// There's no Category model — categoryId has always been a free string set
// by AI REZZO's classifier (matching-engine.ts / ai-orchestrator.ts), not
// an admin-managed list. Rather than fabricate a CRUD layer over a table
// nothing else reads, this surfaces what's actually happening: real case
// volume per category, and which categories have zero KnowledgeSource
// coverage — the concrete, useful "categories" question an admin has.
// SERVICE_CATEGORIES (constants.ts) is that same known taxonomy — also now
// used by the professional apply form's category dropdowns — kept as one
// list instead of two that could quietly drift apart.
const KNOWN_CATEGORIES: Record<string, string | null> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, c.vertical])
);

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const [matterCounts, sourceCounts] = await Promise.all([
      db.matter.groupBy({ by: ['categoryId'], _count: { categoryId: true } }),
      db.knowledgeSource.groupBy({ by: ['category'], where: { active: true }, _count: { category: true } }),
    ]);

    const caseCountByCategory = new Map<string, number>();
    for (const row of matterCounts) {
      if (row.categoryId) caseCountByCategory.set(row.categoryId, row._count.categoryId);
    }
    const sourceCountByCategory = new Map<string, number>();
    for (const row of sourceCounts) {
      sourceCountByCategory.set(row.category, row._count.category);
    }

    const allCategoryIds = new Set([
      ...Object.keys(KNOWN_CATEGORIES),
      ...caseCountByCategory.keys(),
      ...sourceCountByCategory.keys(),
    ]);

    const categories = [...allCategoryIds]
      .map((id) => ({
        id,
        vertical: KNOWN_CATEGORIES[id] || null,
        caseCount: caseCountByCategory.get(id) || 0,
        activeSourceCount: sourceCountByCategory.get(id) || 0,
      }))
      .sort((a, b) => b.caseCount - a.caseCount);

    return NextResponse.json(successResponse({ categories }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
