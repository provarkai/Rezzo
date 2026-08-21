import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { signToken } from '@/lib/auth';
import { z } from 'zod';

const registerSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(['CUSTOMER', 'PROFESSIONAL', 'ADMIN']).default('CUSTOMER'),
  name: z.string().optional(),
  displayName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const { phone, email, role, name, displayName } = parsed.data;
    const profileName = displayName || name || null;

    if (!phone && !email) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Either phone or email is required'),
        { status: 400 }
      );
    }

    // Check for existing user
    const existing = await db.user.findFirst({
      where: {
        OR: phone ? [{ phone }, { email: email || undefined }] : [{ email }],
      },
    });
    if (existing) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'User with this phone or email already exists'),
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        phone: phone || null,
        email: email || null,
        role,
        status: 'ACTIVE',
      },
    });

    // Create profile if displayName provided
    if (profileName) {
      await db.profile.create({
        data: { userId: user.id, displayName: profileName },
      });
    }

    // Issue signed token
    const token = signToken({ userId: user.id, role: user.role });

    return NextResponse.json(
      successResponse({
        user: { id: user.id, displayName: profileName, phone: user.phone, email: user.email, role: user.role },
        token,
      }),
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}