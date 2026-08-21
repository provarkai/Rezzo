import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { signToken } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { z } from 'zod';

const loginSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const { phone, email, password } = parsed.data;

    if (!phone && !email) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Either phone or email is required'),
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        OR: phone ? [{ phone }, { email: email || undefined }] : [{ email }],
        status: 'ACTIVE',
      },
      include: { profile: true, professional: true },
    });

    // Same generic error whether the account doesn't exist or the password
    // is wrong — do not let callers use this endpoint to enumerate accounts.
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json(
        errorResponse('AUTH_INVALID_CREDENTIALS', 'Invalid phone/email or password'),
        { status: 401 }
      );
    }

    // Issue signed token
    const token = signToken({ userId: user.id, role: user.role });

    return NextResponse.json(
      successResponse({
        user: {
          id: user.id,
          displayName: user.profile?.displayName || null,
          phone: user.phone,
          email: user.email,
          role: user.role,
          professionalId: user.professional?.id || null,
          verificationStatus: user.professional?.verificationStatus || null,
        },
        token,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
