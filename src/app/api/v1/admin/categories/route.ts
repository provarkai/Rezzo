import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

// There's no Category model — categoryId has always been a free string set
// by AI REZZO's classifier (matching-engine.ts / ai-orchestrator.ts), not
// an admin-managed list. Rather than fabricate a CRUD layer over a table
// nothing else reads, this surfaces what's actually happening: real case
// volume per category, and which categories have zero KnowledgeSource
// coverage — the concrete, useful "categories" question an admin has.
const KNOWN_CATEGORIES: Record<string, string> = {
  AC_REPAIR: 'HOME_TECHNICAL', GENERATOR_REPAIR: 'HOME_TECHNICAL', PLUMBING: 'HOME_TECHNICAL', ELECTRICAL: 'HOME_TECHNICAL',
  PROPERTY_HOUSING: 'PROPERTY_HOUSING',
  BUSINESS_ENTERPRISE: 'BUSINESS_ENTERPRISE',
  PASSPORT: 'GOVERNMENT_DOCUMENTATION', NIN: 'GOVERNMENT_DOCUMENTATION', BIRTH_CERTIFICATE: 'GOVERNMENT_DOCUMENTATION', DRIVERS_LICENSE: 'GOVERNMENT_DOCUMENTATION', GOVERNMENT_DOC: 'GOVERNMENT_DOCUMENTATION',
};

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
