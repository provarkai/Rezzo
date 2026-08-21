import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { createCase, listUserCases } from '@/lib/domain/case-engine';
import { orchestrateCase } from '@/lib/domain/ai-orchestrator';
import { trackEvent } from '@/lib/analytics';
import { z } from 'zod';

const createCaseSchema = z.object({
  input: z.object({
    text: z.string().min(3, 'Please describe your need in at least 3 characters'),
    location: z.string().optional(),
  }),
  channel: z.string().optional().default('app'),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const body = await request.json();
    const parsed = createCaseSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const { input, channel } = parsed.data;
    const caseRecord = await createCase(auth.user.id, {
      title: input.text.slice(0, 100),
      rawInput: input.text,
      desiredOutcome: input.text,
      location: input.location,
    });

    // Trigger AI orchestration in background (fire and forget for V1)
    orchestrateCase(caseRecord.id).catch(() => {});

    trackEvent({
      event: 'need_created',
      distinctId: auth.user.id,
      properties: { caseId: caseRecord.id, caseNumber: caseRecord.caseNumber, channel },
    }).catch(() => {});

    return NextResponse.json(successResponse({ case: caseRecord }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await listUserCases(auth.user.id, page, limit);

    return NextResponse.json(successResponse(result, { page: result.page, totalPages: result.totalPages }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
