import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { reviewVerification } from '@/lib/domain/verification';
import { z } from 'zod';

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_INFO']),
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
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const result = await reviewVerification(id, auth.user.id, parsed.data.status, parsed.data.notes);

    return NextResponse.json(successResponse({ professional: result }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
