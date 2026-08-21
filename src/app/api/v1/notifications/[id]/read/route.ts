import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const existing = await db.notification.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Notification not found'), { status: 404 });
    }
    if (existing.userId !== auth.user.id) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'You do not have access to this notification'),
        { status: 403 }
      );
    }

    const notification = await db.notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
    });

    return NextResponse.json(successResponse({ notification }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
