import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, PUBLIC_USER_SELECT } from '@/lib/domain/constants';
import { z } from 'zod';

const guestLookupSchema = z.object({
  caseNumber: z.string().min(3, 'Case number is required'),
  phone: z.string().min(6, 'Phone number is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = guestLookupSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const { caseNumber, phone } = parsed.data;

    // Find case by caseNumber (case-insensitive)
    const caseRecord = await db.case.findFirst({
      where: {
        caseNumber: { equals: caseNumber, mode: 'insensitive' },
      },
      include: {
        need: true,
        matter: true,
        user: { select: PUBLIC_USER_SELECT },
        participants: {
          include: { user: { select: { ...PUBLIC_USER_SELECT, professional: true } } },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        quotes: {
          include: {
            professional: { include: { user: { select: PUBLIC_USER_SELECT } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!caseRecord) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'No case found with that case number. Please check and try again.'),
        { status: 404 }
      );
    }

    // Verify phone matches the case owner
    const ownerPhone = caseRecord.user?.phone;
    const normalizedInput = phone.replace(/[^0-9]/g, '');
    const normalizedOwner = ownerPhone?.replace(/[^0-9]/g, '') || '';

    if (normalizedInput !== normalizedOwner) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'The phone number does not match the case owner. Please use the phone number you registered with.'),
        { status: 403 }
      );
    }

    // Return a limited guest-safe view of the case
    const guestData = {
      case: {
        id: caseRecord.id,
        caseNumber: caseRecord.caseNumber,
        status: caseRecord.status,
        vertical: caseRecord.vertical,
        location: caseRecord.location,
        state: caseRecord.state,
        priority: caseRecord.priority,
        createdAt: caseRecord.createdAt,
        updatedAt: caseRecord.updatedAt,
        resolvedAt: caseRecord.resolvedAt,
      },
      need: caseRecord.need
        ? {
            title: caseRecord.need.title,
            rawInput: caseRecord.need.rawInput,
            desiredOutcome: caseRecord.need.desiredOutcome,
          }
        : null,
      matter: caseRecord.matter
        ? {
            summary: caseRecord.matter.summary,
            categoryId: caseRecord.matter.categoryId,
            urgency: caseRecord.matter.urgency,
          }
        : null,
      events: caseRecord.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actorType: e.actorType,
        createdAt: e.createdAt,
        payload: e.payload,
      })),
      quotes: caseRecord.quotes.map((q) => ({
        id: q.id,
        status: q.status,
        amount: q.totalAmount,
        currency: q.currency,
        professionalName: q.professional?.user?.profile?.displayName || 'Professional',
        createdAt: q.createdAt,
        expiresAt: q.expiresAt,
      })),
      payments: caseRecord.payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount: p.grossAmount,
        currency: p.currency,
        createdAt: p.createdAt,
      })),
      participantCount: caseRecord.participants.length,
      assignedProfessional: caseRecord.participants.find(
        (p) => p.role === 'PROFESSIONAL'
      )
        ? {
            name:
              caseRecord.participants.find((p) => p.role === 'PROFESSIONAL')?.user?.profile
                ?.displayName || 'Assigned Professional',
          }
        : null,
    };

    return NextResponse.json(successResponse(guestData));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
