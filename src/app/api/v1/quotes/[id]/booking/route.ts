import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { notify } from '@/lib/domain/notification-service';
import { z } from 'zod';

// Booking = Scheduled service (PRD §"Booking"). The professional proposes a
// slot for an accepted, funded quote; the customer confirms it separately
// (POST /bookings/[id]/confirm), which is what actually starts the case's
// IN_PROGRESS stage. One Booking per quote (Booking.quoteId is @unique) —
// re-posting here updates that same row rather than creating a new one, as
// long as the customer hasn't already confirmed it.
const bookingSchema = z.object({
  startsAt: z.string().min(1, 'A start time is required'),
  endsAt: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
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
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const startsAt = new Date(parsed.data.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'startsAt is not a valid date'), { status: 400 });
    }
    let endsAt: Date | null = null;
    if (parsed.data.endsAt) {
      endsAt = new Date(parsed.data.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        return NextResponse.json(errorResponse('VALIDATION_ERROR', 'endsAt is not a valid date'), { status: 400 });
      }
    }

    const professional = await db.professional.findUnique({ where: { userId: auth.user.id } });
    if (!professional) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only professionals can schedule appointments'), { status: 403 });
    }

    const quote = await db.quote.findUnique({ where: { id }, include: { case: true } });
    if (!quote) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Quote not found'), { status: 404 });
    }
    if (quote.professionalId !== professional.id) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'This is not your quote'), { status: 403 });
    }
    if (quote.status !== 'ACCEPTED') {
      return NextResponse.json(errorResponse('CONFLICT', 'Only an accepted quote can be scheduled'), { status: 409 });
    }
    if (!['FUNDED', 'IN_PROGRESS'].includes(quote.case.status)) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'The case must be funded before an appointment can be scheduled'),
        { status: 409 }
      );
    }

    const existing = await db.booking.findUnique({ where: { quoteId: quote.id } });
    if (existing?.confirmedAt) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'This appointment is already confirmed — cancel it before proposing a new time'),
        { status: 409 }
      );
    }

    const data = {
      startsAt,
      endsAt,
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
      status: 'SCHEDULED',
    };

    const booking = existing
      ? await db.booking.update({ where: { id: existing.id }, data })
      : await db.booking.create({
          data: {
            ...data,
            caseId: quote.caseId,
            professionalId: professional.id,
            quoteId: quote.id,
          },
        });

    try {
      await notify({
        userId: quote.case.userId,
        caseId: quote.caseId,
        type: 'BOOKING_PROPOSED',
        title: `Appointment proposed for ${quote.case.caseNumber}`,
        body: `Your professional proposed ${startsAt.toLocaleString('en-NG')}. Review and confirm it in the case.`,
      });
    } catch {
      // Notification is best-effort
    }

    return NextResponse.json(successResponse({ booking }), { status: existing ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
