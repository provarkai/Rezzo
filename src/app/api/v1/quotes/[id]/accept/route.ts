import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, CASE_EVENTS } from '@/lib/domain/constants';
import { transitionCase, addCaseEvent, addParticipant } from '@/lib/domain/case-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const quote = await db.quote.findUnique({
      where: { id },
      include: { case: true, professional: true },
    });

    if (!quote) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Quote not found'), { status: 404 });
    }

    if (quote.case.userId !== auth.user.id) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only the case owner can accept quotes'), { status: 403 });
    }

    if (quote.status !== 'SENT') {
      return NextResponse.json(errorResponse('CONFLICT', `Quote is already ${quote.status}`), { status: 409 });
    }

    // Update quote status
    const updatedQuote = await db.quote.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    // Decline other quotes for this case
    await db.quote.updateMany({
      where: {
        caseId: quote.caseId,
        id: { not: id },
        status: 'SENT',
      },
      data: { status: 'DECLINED' },
    });

    // Add QUOTE_ACCEPTED event
    await addCaseEvent(quote.caseId, CASE_EVENTS.QUOTE_ACCEPTED, 'CUSTOMER', auth.user.id, {
      quoteId: quote.id,
      professionalId: quote.professionalId,
      totalAmount: quote.totalAmount,
    });

    // Transition case to ACCEPTED
    try {
      await transitionCase(quote.caseId, 'ACCEPTED', auth.user.id, 'CUSTOMER');
    } catch {
      // May already be transitioning
    }

    // Add professional as participant with full access
    await addParticipant(quote.caseId, quote.professional.userId, 'PROFESSIONAL', {
      canView: true,
      canMessage: true,
      canSubmitProof: true,
      canStartService: true,
    });

    return NextResponse.json(successResponse({ quote: updatedQuote }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
