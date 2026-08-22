import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, ROLES } from '@/lib/domain/constants';
import { transitionCase } from '@/lib/domain/case-engine';
import { notify } from '@/lib/domain/notification-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: { case: true, professional: { select: { userId: true } } },
    });
    if (!booking) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Appointment not found'), { status: 404 });
    }
    if (booking.case.userId !== auth.user.id) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Only the case owner can confirm this appointment'),
        { status: 403 }
      );
    }
    if (booking.status === 'CANCELLED') {
      return NextResponse.json(errorResponse('CONFLICT', 'This appointment was cancelled'), { status: 409 });
    }

    // Already confirmed — idempotent, just return it rather than erroring.
    if (booking.confirmedAt) {
      return NextResponse.json(successResponse({ booking }));
    }

    const updated = await db.booking.update({
      where: { id },
      data: { confirmedAt: new Date() },
    });

    // Confirming the slot is what actually kicks off IN_PROGRESS — this was
    // previously the only place FUNDED -> IN_PROGRESS ever fired from.
    try {
      await transitionCase(booking.caseId, 'IN_PROGRESS', auth.user.id, ROLES.CUSTOMER);
    } catch {
      // Case may already be IN_PROGRESS
    }

    try {
      await notify({
        userId: booking.professional.userId,
        caseId: booking.caseId,
        type: 'BOOKING_CONFIRMED',
        title: `Appointment confirmed for ${booking.case.caseNumber}`,
        body: 'The customer confirmed the proposed time. You can start work at that time.',
      });
    } catch {
      // Notification is best-effort
    }

    return NextResponse.json(successResponse({ booking: updated }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
