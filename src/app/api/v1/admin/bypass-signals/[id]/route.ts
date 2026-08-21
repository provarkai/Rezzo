import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { z } from 'zod';

// Ops reviews a signal; CONFIRMED (enforcement) is deliberately not an
// option here — the detector never sets it and neither does this endpoint.
// Confirming intentional circumvention is a bigger policy action than a
// status flip and isn't implemented yet (PRD Upgrade §6.2 level 4).
const reviewSchema = z.object({
  status: z.enum(['REVIEWED', 'DISMISSED', 'ACTION_TAKEN']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const existing = await db.bypassSignal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Bypass signal not found'), { status: 404 });
    }

    const signal = await db.bypassSignal.update({
      where: { id },
      data: { status: parsed.data.status },
    });

    return NextResponse.json(successResponse({ signal }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
