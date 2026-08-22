import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { submitReview } from '@/lib/domain/case-engine';
import { z } from 'zod';

const reviewSchema = z.object({
  professionalId: z.string().min(1, 'Professional ID is required'),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    // Verify the case belongs to the user
    const caseRecord = await db.case.findUnique({ where: { id } });
    if (!caseRecord || caseRecord.userId !== auth.user.id) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only the case owner can submit a review'), { status: 403 });
    }

    const review = await submitReview(
      id,
      auth.user.id,
      parsed.data.professionalId,
      parsed.data.rating,
      parsed.data.comment
    );

    return NextResponse.json(successResponse({ review }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
