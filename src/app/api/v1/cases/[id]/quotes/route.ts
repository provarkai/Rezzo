import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, CASE_EVENTS } from '@/lib/domain/constants';
import { addCaseEvent, addParticipant, transitionCase } from '@/lib/domain/case-engine';
import { z } from 'zod';

const quoteSchema = z.object({
  serviceId: z.string().optional(),
  scope: z.string().optional(),
  totalAmount: z.number().positive('Amount must be positive'),
  currency: z.string().default('NGN'),
  timeline: z.string().optional(),
  milestones: z.array(z.object({
    title: z.string(),
    amount: z.number().positive(),
    sequence: z.number().int().positive(),
  })).optional(),
  terms: z.string().optional(),
  expiresAt: z.string().optional(),
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
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    // Verify user is a professional with a professional record
    const professional = await db.professional.findUnique({
      where: { userId: auth.user.id },
    });
    if (!professional) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only verified professionals can submit quotes'), { status: 403 });
    }

    // Verify case exists
    const caseRecord = await db.case.findUnique({ where: { id } });
    if (!caseRecord) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Case not found'), { status: 404 });
    }

    // Check if already submitted a quote
    const existingQuote = await db.quote.findFirst({
      where: { caseId: id, professionalId: professional.id, status: 'SENT' },
    });
    if (existingQuote) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'You already have an active quote for this case'),
        { status: 409 }
      );
    }

    const milestonesJson = parsed.data.milestones || [];
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    // Create quote
    const quote = await db.quote.create({
      data: {
        caseId: id,
        professionalId: professional.id,
        serviceId: parsed.data.serviceId || null,
        scope: parsed.data.scope || null,
        totalAmount: parsed.data.totalAmount,
        currency: parsed.data.currency,
        timeline: parsed.data.timeline || null,
        milestonesJson: milestonesJson as object,
        terms: parsed.data.terms || null,
        status: 'SENT',
        expiresAt,
      },
    });

    // Create milestones if provided
    if (parsed.data.milestones && parsed.data.milestones.length > 0) {
      for (const ms of parsed.data.milestones) {
        await db.milestone.create({
          data: {
            quoteId: quote.id,
            title: ms.title,
            amount: ms.amount,
            sequence: ms.sequence,
            status: 'PENDING',
          },
        });
      }
    }

    // Add professional as participant
    await addParticipant(id, auth.user.id, 'PROFESSIONAL', {
      canView: true,
      canMessage: true,
      canSubmitQuote: true,
    });

    // Add QUOTE_RECEIVED event
    await addCaseEvent(id, CASE_EVENTS.QUOTE_RECEIVED, 'PROFESSIONAL', auth.user.id, {
      quoteId: quote.id,
      totalAmount: quote.totalAmount,
      professionalId: professional.id,
    });

    // Transition case to QUOTE if not already
    try {
      await transitionCase(id, 'QUOTE', caseRecord.userId, 'PROFESSIONAL');
    } catch {
      // May already be in QUOTE state
    }

    return NextResponse.json(successResponse({ quote }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const quotes = await db.quote.findMany({
      where: { caseId: id },
      include: {
        professional: {
          include: { user: { include: { profile: true } } },
        },
        service: true,
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(successResponse({ quotes }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
