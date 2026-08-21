import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { notify } from '@/lib/domain/notification-service';

// Either side of the appointment can cancel it — the customer to decline a
// proposed time, the professional to withdraw one. Cancelling clears
// confirmedAt too, so the professional can propose a fresh slot on the same
// quote (Booking.quoteId is @unique, so this row is reused rather than a
// new one created). It deliberately does not roll the case status back if
// it had already reached IN_PROGRESS from a prior confirm — that's a known
// simplification, not something this route tries to resolve.
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

    const isCustomer = booking.case.userId === auth.user.id;
    const isProfessional = booking.professional.userId === auth.user.id;
    if (!isCustomer && !isProfessional && auth.user.role !== 'ADMIN') {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'You do not have access to this appointment'),
        { status: 403 }
      );
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json(successResponse({ booking }));
    }

    const updated = await db.booking.update({
      where: { id },
      data: { status: 'CANCELLED', confirmedAt: null },
    });

    try {
      const notifyUserId = isCustomer ? booking.professional.userId : booking.case.userId;
      await notify({
        userId: notifyUserId,
        caseId: booking.caseId,
        type: 'BOOKING_CANCELLED',
        title: `Appointment cancelled for ${booking.case.caseNumber}`,
        body: isCustomer
          ? 'The customer cancelled the proposed appointment time.'
          : 'The professional cancelled the proposed appointment time.',
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
