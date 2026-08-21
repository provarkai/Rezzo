import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { submitApplication } from '@/lib/domain/verification';
import { z } from 'zod';

const applySchema = z.object({
  bio: z.string().optional(),
  serviceArea: z.string().min(2, 'Service area is required'),
  skills: z.array(z.object({
    name: z.string().min(1),
    level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).default('INTERMEDIATE'),
    categoryId: z.string().optional(),
  })).min(1, 'At least one skill is required'),
  services: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    pricingType: z.enum(['FIXED', 'STARTING_FROM', 'QUOTE_REQUIRED', 'HOURLY', 'MILESTONE']).default('QUOTE_REQUIRED'),
    categoryId: z.string().optional(),
    prices: z.array(z.object({
      amount: z.number().positive(),
      unit: z.string().optional(),
    })).optional(),
  })).min(1, 'At least one service is required'),
  credentials: z.array(z.object({
    type: z.enum(['IDENTITY', 'LICENSE', 'CERTIFICATE', 'DEGREE']),
    issuer: z.string().optional(),
    reference: z.string().optional(),
  })).min(1, 'At least one credential is required'),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    // Check if user already has a professional record
    const existing = await (await import('@/lib/db')).db.professional.findUnique({
      where: { userId: auth.user.id },
    });
    if (existing) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'Professional application already exists'),
        { status: 409 }
      );
    }

    const professional = await submitApplication(auth.user.id, parsed.data);

    return NextResponse.json(successResponse({ professional }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
